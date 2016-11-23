import { Reporter, ReporterConfig, Config } from '../../interfaces';
import { Suite } from '../Suite';
import { Test } from '../Test';
import * as Tunnel from 'digdug/Tunnel';
import * as charm from 'dojo/node!charm';
import * as encode from 'dojo/node!charm/lib/encode';
import * as nodeUtil from 'dojo/node!util';
import * as lang from 'dojo/lang';
import * as internUtil from '../util';
import Collector = require('dojo/has!host-node?dojo/node!istanbul/lib/collector');
import TextReport = require('dojo/has!host-node?dojo/node!istanbul/lib/report/text');

export type Charm = charm.Charm;

/**
 * Handles presentation of runner results to the user
 */

const PAD = new Array(100).join(' ');
const SPINNER_STATES = [ '/', '-', '\\', '|' ];
const PASS = 0;
const SKIP = 1;
const FAIL = 2;
const BROWSERS = {
	chrome: 'Chr',
	firefox: 'Fx',
	opera: 'O',
	safari: 'Saf',
	'internet explorer': 'IE',
	phantomjs: 'Phan'
};

const ASCII_COLOR = {
	red: encode('[31m'),
	green: encode('[32m'),
	yellow: encode('[33m'),
	reset: encode('[0m')
};

/**
 * Model tracking test results
 * @param {string} environment the environment associated with the report
 * @param {string?} sessionId the sessionId associated with the report
 * @constructor
 */
export class Report {
	environment: string;
	sessionId: string;
	numTotal: number = 0;
	numPassed: number = 0;
	numFailed: number = 0;
	numSkipped: number = 0;
	results: number[] = [];
	coverage: Collector = new Collector();

	constructor(environment?: string, sessionId?: string) {
		this.environment = environment;
		this.sessionId = sessionId;
	}

	get finished() {
		return this.results.length;
	}

	record(result: number): void {
		this.results.push(result);
		switch (result) {
		case PASS:
			++this.numPassed;
			break;
		case SKIP:
			++this.numSkipped;
			break;
		case FAIL:
			++this.numFailed;
			break;
		}
	}

	getCompressedResults(maxWidth: number): number[] {
		const total = Math.max(this.numTotal, this.results.length);
		const width = Math.min(maxWidth, total);
		const resultList: number[] = [];

		for (let i = 0; i < this.results.length; ++i) {
			const pos = Math.floor(i / total * width);
			resultList[pos] = Math.max(resultList[pos] || PASS, this.results[i]);
		}

		return resultList;
	}
}

function pad(width: number): string {
	return PAD.slice(0, Math.max(width, 0));
}

function fit(text: string|number, width: number, padLeft: boolean = false): string {
	text = String(text);
	if (text.length < width) {
		if (padLeft) {
			return pad(width - text.length) + text;
		}
		return text + pad(width - text.length);
	}
	return text.slice(0, width);
}

export interface PrettyReporterConfig extends ReporterConfig {
	internConfig?: Config;
	dimensions?: any;
	titleWidth?: number;
	maxProgressBarWidth?: number;
	colorReplacement?: any;
}

export class PrettyReporter implements Reporter {
	internConfig: Config;
	spinnerOffset: number;
	dimensions: any;
	titleWidth: number;
	maxProgressBarWidth: number;
	colorReplacement: any;
	header: string;
	reporters: any;
	log: string[];
	total: Report;
	watermarks: any;
	tunnelState: string;
	charm: Charm;
	/* private */ _renderTimeout: NodeJS.Timer;
	/* private */ _Report = Report;

	constructor(config: PrettyReporterConfig = {}) {
		this.internConfig = config.internConfig;
		this.spinnerOffset = 0;
		this.dimensions = config.dimensions || {};
		this.titleWidth = config.titleWidth || 12;
		this.maxProgressBarWidth = config.maxProgressBarWidth || 40;
		this.colorReplacement = lang.mixin({
			0: ASCII_COLOR.green + '✓',
			1: ASCII_COLOR.reset + '~',
			2: ASCII_COLOR.red + '×',
			'✓': ASCII_COLOR.green,
			'!': ASCII_COLOR.red,
			'×': ASCII_COLOR.red,
			'~': ASCII_COLOR.reset,
			'⚠': ASCII_COLOR.yellow
		}, config.colorReplacement);
		this.header = '';
		this.reporters = {};
		this.log = [];
		this.total = new Report();
		this.watermarks = config.watermarks;
		this.tunnelState = '';
		this._renderTimeout = undefined;
	}

	runStart() {
		this.header = this.internConfig.config;
		this.charm = this.charm || this._newCharm();

		const resize = () => {
			this.dimensions.width = (<any> process.stdout).columns || 80;
			this.dimensions.height = (<any> process.stdout).rows || 24;
		};

		resize();
		process.stdout.on('resize', resize);

		const rerender = () => {
			this.charm.erase('screen').position(0, 0);
			this._render();
			this._renderTimeout = setTimeout(rerender, 200);
		};
		rerender();
	}

	runEnd() {
		const charm = this.charm;
		clearTimeout(this._renderTimeout);
		charm.erase('screen').position(0, 0);

		// write a full log of errors
		// Sort logs: pass < deprecated < skip < errors < fail
		const ERROR_LOG_WEIGHT = { '!': 4, '×': 3, '~': 2, '⚠': 1, '✓': 0 };
		const logs = this.log.sort(function (a: any, b: any) {
			a = (<{ [key: string]: any }> ERROR_LOG_WEIGHT)[a.charAt(0)] || 0;
			b = (<{ [key: string]: any }> ERROR_LOG_WEIGHT)[b.charAt(0)] || 0;
			return a - b;
		}).map(line => {
			const color = this.colorReplacement[line.charAt(0)];
			return color + line;
		}).join('\n');
		charm.write(logs);
		charm.write('\n\n');

		// Display the pretty results
		this._render(true);

		// Display coverage information
		if (this.total.coverage.files().length > 0) {
			charm.write('\n');
			(new TextReport({
				watermarks: this.watermarks
			})).writeReport(this.total.coverage, true);
		}
	}

	coverage(sessionId: string, coverage: Object): void {
		const reporter = this.reporters[sessionId];
		reporter && reporter.coverage.add(coverage);
		this.total.coverage.add(coverage);
	}

	suiteStart(suite: Suite): void {
		if (!suite.hasParent) {
			const numTests = suite.numTests;
			this.total.numTotal += numTests;

			if (suite.sessionId) {
				this._getReporter(suite).numTotal += numTests;
			}
		}
	}

	suiteError(suite: Suite, error: Error) {
		this._record(suite.sessionId, FAIL);

		const message = '! ' + suite.id;
		this.log.push(message + '\n' + internUtil.getErrorMessage(error));
	}

	testSkip(test: Test): void {
		this._record(test.sessionId, SKIP);
		this.log.push('~ ' + test.id + ': ' + (test.skipped || 'skipped'));
	}

	testPass(test: Test): void {
		this._record(test.sessionId, PASS);
		this.log.push('✓ ' + test.id);
	}

	testFail(test: Test): void {
		const message = '× ' + test.id;
		this._record(test.sessionId, FAIL);
		this.log.push(message + '\n' + internUtil.getErrorMessage(test.error));
	}

	tunnelStart(): void {
		this.tunnelState = 'Starting';
	}

	tunnelDownloadProgress(tunnel: Tunnel, progress: any): void {
		this.tunnelState = 'Downloading ' + (progress.received / progress.numTotal * 100).toFixed(2) + '%';
	}

	tunnelStatus(tunnel: Tunnel, status: string): void {
		this.tunnelState = status;
	}

	runnerStart(): void {
		this.tunnelState = 'Ready';
	}

	fatalError(error: Error): void {
		const message = '! ' + error.message;
		this.log.push(message + '\n' + internUtil.getErrorMessage(error));
		// stop the render timeout on a fatal error so Intern can exit
		clearTimeout(this._renderTimeout);
	}

	deprecated(name: string, replacement: string, extra?: string): void {
		let message = '⚠ ' + name + ' is deprecated.';

		if (replacement) {
			message += ' Use ' + replacement + ' instead.';
		}

		if (extra) {
			message += ' ' + extra;
		}

		this.log.push(message);
	}

	/**
	 * Return the reporter for a given session, creating it if necessary.
	 */
	private _getReporter(suite: Suite): Report {
		if (!this.reporters[suite.sessionId]) {
			this.reporters[suite.sessionId] = new Report(suite.remote && suite.remote.environmentType.toString());
		}
		return this.reporters[suite.sessionId];
	}

	/**
	 * Create the charm instance used by this reporter.
	 */
	private _newCharm(): Charm {
		const c = charm();
		c.pipe(process.stdout);
		return c;
	}

	private _record(sessionId: string, result: number): void {
		const reporter = this.reporters[sessionId];
		reporter && reporter.record(result);
		this.total.record(result);
	}

	/**
	 * Render the progress bar
	 * [✔︎~✔︎×✔︎✔︎✔︎✔︎✔︎✔︎] 99/100
	 * @param report the report data to render
	 * @param width the maximum width for the entire progress bar
	 */
	private _drawProgressBar(report: Report, width: number): void {
		const spinnerCharacter = SPINNER_STATES[this.spinnerOffset];
		const charm = this.charm;
		if (!report.numTotal) {
			charm.write('Pending');
			return;
		}

		const totalTextSize = String(report.numTotal).length;
		const remainingWidth = Math.max(width - 4 - (totalTextSize * 2), 1);
		const barSize = Math.min(remainingWidth, report.numTotal, this.maxProgressBarWidth);
		const results = report.getCompressedResults(barSize);

		charm.write('[' + results.map(value => this.colorReplacement[value]).join(''));
		charm.display('reset').write(fit(spinnerCharacter, barSize - results.length) + '] ' +
			fit(report.finished, totalTextSize, true) + '/' + report.numTotal);
	}

	/**
	 * Render a single line
	 * TITLE:        [✔︎~✔︎×✔︎✔︎✔︎✔︎✔︎✔︎] 100/100, 2 fail, 1 skip
	 * TODO split this into two lines. The first line will display the
	 * title, OS and code coverage and the progress bar on the second
	 */
	private _drawSessionReporter(report: Report): void {
		const charm = this.charm;
		const titleWidth = this.titleWidth;
		const leftOfBar = fit(this._abbreviateEnvironment(report.environment).slice(0, titleWidth - 2) + ': ',
			titleWidth);
		const rightOfBar = '' +
			(report.numFailed ? ', ' + report.numFailed + ' fail' : '') +
			(report.numSkipped ? ', ' + report.numSkipped + ' skip' : '');
		const barWidth = this.dimensions.width - rightOfBar.length - titleWidth;

		charm.write(leftOfBar);
		this._drawProgressBar(report, barWidth);
		charm.write(rightOfBar + '\n');
	}

	/**
	 * Abbreviate the environment information for rendering
	 * @param env the test environment
	 * @returns {string} abbreviated environment information
	 */
	private _abbreviateEnvironment(env: any): string {
		const browser = (<{ [key: string]: any }> BROWSERS)[env.browserName.toLowerCase()] || env.browserName.slice(0, 4);
		const result = [browser];

		if (env.version) {
			let version = String(env.version);
			if (version.indexOf('.') > -1) {
				version = version.slice(0, version.indexOf('.'));
			}
			result.push(version);
		}

		if (env.platform) {
			result.push(env.platform.slice(0, 3));
		}

		return result.join(' ');
	}

	/* private */ _render(omitLogs: boolean = false) {
		const charm = this.charm;
		const numReporters = Object.keys(this.reporters).length;
		const logLength = this.dimensions.height - numReporters - 4 /* last line & total */ -
			(this.tunnelState ? 2 : 0) - (numReporters ? 1 : 0) - (this.header ? 1 : 0);
		this.spinnerOffset = (++this.spinnerOffset) % SPINNER_STATES.length;

		charm.display('reset');
		this.header && charm.write(this.header + '\n');
		this.tunnelState && charm.write('Tunnel: ' + this.tunnelState + '\n\n');
		this._drawTotalReporter(this.total);

		// TODO if there is not room to render all reporters only render
		// active ones or only the total with less space
		if (numReporters) {
			charm.write('\n');
			for (let key in this.reporters) {
				this._drawSessionReporter(this.reporters[key]);
			}
		}

		if (!omitLogs && logLength > 0 && this.log.length) {
			const allowed = { '×': true, '⚠': true, '!': true };
			const logs = this.log.filter(line => {
				return (<{ [key: string]: any }> allowed)[line.charAt(0)];
			}).slice(-logLength).map(line => {
				// truncate long lines
				const color = (<{ [key: string]: any }> this.colorReplacement)[line.charAt(0)] || ASCII_COLOR.reset;
				line = line.split('\n', 1)[0];
				return color + line.slice(0, this.dimensions.width) + ASCII_COLOR.reset;
			}).join('\n');
			charm.write('\n');
			charm.write(logs);
		}
	}

	private _drawTotalReporter(report: Report): void {
		const charm = this.charm;
		const title = 'Total: ';
		const totalTextSize = String(report.numTotal).length;

		charm.write(title);
		this._drawProgressBar(report, this.dimensions.width - title.length);
		charm.write(nodeUtil.format('\nPassed: %s  Failed: %s  Skipped: %d\n',
			fit(report.numPassed, totalTextSize), fit(report.numFailed, totalTextSize), report.numSkipped));
	}
}
