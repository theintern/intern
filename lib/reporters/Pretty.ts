import charm = require('charm');
import encode = require('charm/lib/encode');
import { format } from 'util';
import { getErrorMessage } from '../util';
import Collector = require('istanbul/lib/collector');
import IstanbulReporter = require('istanbul/lib/report/text');
import { Reporter, ReporterKwArgs } from '../ReporterManager';
import { CoverageMap } from 'istanbul/lib/instrumenter';
import { Watermarks } from 'istanbul/lib/report/common/defaults';
import Suite from '../Suite';
import Test from '../Test';
import Tunnel = require('digdug/Tunnel');
import EnvironmentType from '../EnvironmentType';
import { WriteStream as TtyStream } from 'tty';
import { InternConfig } from '../executors/PreExecutor';

const PAD = new Array(100).join(' ');
const SPINNER_STATES = [ '/', '-', '\\', '|' ];
export const enum Result {
	Pass = 0,
	Skip = 1,
	Fail = 2
}
const BROWSERS: { [browser: string]: string; } = {
	chrome: 'Chr',
	firefox: 'Fx',
	opera: 'O',
	safari: 'Saf',
	'internet explorer': 'IE',
	phantomjs: 'Phan'
};
const ASCII_COLOR = {
	red: String(encode('[31m')),
	green: String(encode('[32m')),
	yellow: String(encode('[33m')),
	reset: String(encode('[0m'))
};

/**
 * Model tracking test results
 * @param {string} environment the environment associated with the report
 * @param {string?} sessionId the sessionId associated with the report
 * @constructor
 */
export class Report {
	environment: EnvironmentType;
	numTotal: number;
	numPassed: number;
	numFailed: number;
	numSkipped: number;
	results: Result[];
	coverage: Collector;

	constructor(environment: EnvironmentType) {
		this.environment = environment;
		this.numTotal = 0;
		this.numPassed = 0;
		this.numFailed = 0;
		this.numSkipped = 0;
		this.results = [];
		this.coverage = new Collector();
	}

	get finished() {
		return this.results.length;
	}

	record(result: Result) {
		this.results.push(result);
		switch (result) {
		case Result.Pass:
			++this.numPassed;
			break;
		case Result.Skip:
			++this.numSkipped;
			break;
		case Result.Fail:
			++this.numFailed;
			break;
		}
	}

	getCompressedResults(maxWidth: number) {
		const total = Math.max(this.numTotal, this.results.length);
		const width = Math.min(maxWidth, total);
		const resultList: number[] = [];

		for (let i = 0; i < this.results.length; ++i) {
			const pos = Math.floor(i / total * width);
			resultList[pos] = Math.max(resultList[pos] || Result.Pass, this.results[i]);
		}

		return resultList;
	}
}

function pad(width: number) {
	return PAD.slice(0, Math.max(width, 0));
}

function fit(text: string, width: number, padLeft: boolean = false) {
	text = String(text);
	if (text.length < width) {
		if (padLeft) {
			return pad(width - text.length) + text;
		}
		return text + pad(width - text.length);
	}
	return text.slice(0, width);
}

interface Dimensions {
	width: number;
	height: number;
}

export interface KwArgs extends ReporterKwArgs {
	dimensions?: Dimensions;
	titleWidth?: number;
	maxProgressBarWidth?: number;
}

export default class Pretty implements Reporter {
	internConfig: InternConfig;
	spinnerOffset: number;
	dimensions: Dimensions;
	titleWidth: number;
	maxProgressBarWidth: number;
	colorReplacement: {
		[result: /* Result */ number]: string;
		[character: string]: string;
	};
	header: string;
	reporters: { [sessionId: string]: Report; };
	log: string[];
	total: Report;
	tunnelState: string;
	private _renderTimeout: NodeJS.Timer;
	private _reporter: IstanbulReporter;
	charm: charm.Charm;

	constructor(config: KwArgs = {}) {
		this.internConfig = config.internConfig;
		this.spinnerOffset = 0;
		this.dimensions = config.dimensions || { width: 80, height: 24 };
		this.titleWidth = config.titleWidth || 12;
		this.maxProgressBarWidth = config.maxProgressBarWidth || 40;
		this.colorReplacement = {
			0: String(ASCII_COLOR.green) + '✓',
			1: String(ASCII_COLOR.reset) + '~',
			2: String(ASCII_COLOR.red) + '×',
			'✓': String(ASCII_COLOR.green),
			'!': String(ASCII_COLOR.red),
			'×': String(ASCII_COLOR.red),
			'~': String(ASCII_COLOR.reset),
			'⚠': String(ASCII_COLOR.yellow)
		};
		this.header = '';
		this.reporters = {};
		this.log = [];
		this.total = new Report(null);
		this.tunnelState = '';
		this._renderTimeout = undefined;
		this._reporter = new IstanbulReporter({
			watermarks: config.watermarks
		});
	}

	runStart() {
		this.header = this.internConfig.config;
		this.charm = this.charm || this._newCharm();

		const self = this;
		function resize() {
			self.dimensions.width = (<TtyStream> process.stdout).columns || 80;
			self.dimensions.height = (<TtyStream> process.stdout).rows || 24;
		}
		resize();
		process.stdout.on('resize', resize);

		(function rerender() {
			self.charm.erase('screen').position(0, 0);
			self._render();
			self._renderTimeout = setTimeout(rerender, 200);
		})();
	}

	runEnd() {
		const charm = this.charm;
		clearTimeout(this._renderTimeout);
		charm.erase('screen').position(0, 0);

		// write a full log of errors
		// Sort logs: pass < deprecated < skip < errors < fail
		const ERROR_LOG_WEIGHT: { [key: string]: number; } = { '!': 4, '×': 3, '~': 2, '⚠': 1, '✓': 0 };
		const logs = this.log.sort(function (a, b) {
			let aWeight = ERROR_LOG_WEIGHT[a.charAt(0)] || 0;
			let bWeight = ERROR_LOG_WEIGHT[b.charAt(0)] || 0;
			return aWeight - bWeight;
		}).map(function (line) {
			const color = this.colorReplacement[line.charAt(0)];
			return color + line;
		}, this).join('\n');
		charm.write(logs);
		charm.write('\n\n');

		// Display the pretty results
		this._render(true);

		// Display coverage information
		charm.write('\n');
		this._reporter.writeReport(this.total.coverage, true);
	}

	coverage(sessionId: string, coverage: CoverageMap) {
		const reporter = this.reporters[sessionId];
		reporter && reporter.coverage.add(coverage);
		this.total.coverage.add(coverage);
	}

	suiteStart(suite: Suite) {
		if (!suite.hasParent) {
			const numTests = suite.numTests;
			this.total.numTotal += numTests;

			if (suite.sessionId) {
				this._getReporter(suite).numTotal += numTests;
			}
		}
	}

	suiteError(suite: Suite, error: Error) {
		this._record(suite.sessionId, Result.Fail);

		const message = '! ' + suite.id;
		this.log.push(message + '\n' + getErrorMessage(error));
	}

	testSkip(test: Test) {
		this._record(test.sessionId, Result.Skip);
		this.log.push('~ ' + test.id + ': ' + (test.skipped || 'skipped'));
	}

	testPass(test: Test) {
		this._record(test.sessionId, Result.Pass);
		this.log.push('✓ ' + test.id);
	}

	testFail(test: Test) {
		const message = '× ' + test.id;
		this._record(test.sessionId, Result.Fail);
		this.log.push(message + '\n' + getErrorMessage(test.error));
	}

	tunnelStart() {
		this.tunnelState = 'Starting';
	}

	tunnelDownloadProgress(tunnel: Tunnel, progress: Tunnel.Progress) {
		this.tunnelState = 'Downloading ' + (progress.loaded / progress.total * 100).toFixed(2) + '%';
	}

	tunnelStatus(tunnel: Tunnel, status: string) {
		this.tunnelState = status;
	}

	runnerStart() {
		this.tunnelState = 'Ready';
	}

	fatalError(error: Error) {
		const message = '! ' + error.message;
		this.log.push(message + '\n' + getErrorMessage(error));
		// stop the render timeout on a fatal error so Intern can exit
		clearTimeout(this._renderTimeout);
	}

	deprecated(name: string, replacement?: string, extra?: string) {
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
	_getReporter(suite: Suite) {
		if (!this.reporters[suite.sessionId]) {
			this.reporters[suite.sessionId] = new Report(suite.remote.environmentType);
		}
		return this.reporters[suite.sessionId];
	}

	/**
	 * Create the charm instance used by this reporter.
	 */
	_newCharm() {
		const instance = new charm.Charm();
		instance.pipe(process.stdout);
		return instance;
	}

	_record(sessionId: string, result: Result) {
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
	_drawProgressBar(report: Report, width: number) {
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

		charm.write('[' + results.map(function (value) {
			return this.colorReplacement[value];
		}, this).join(''));
		charm.display('reset').write(fit(spinnerCharacter, barSize - results.length) + '] ' +
			fit(String(report.finished), totalTextSize, true) + '/' + report.numTotal);
	}

	/**
	 * Render a single line
	 * TITLE:        [✔︎~✔︎×✔︎✔︎✔︎✔︎✔︎✔︎] 100/100, 2 fail, 1 skip
	 * TODO split this into two lines. The first line will display the
	 * title, OS and code coverage and the progress bar on the second
	 */
	_drawSessionReporter(report: Report) {
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
	_abbreviateEnvironment(env: EnvironmentType) {
		const browser = BROWSERS[env.browserName.toLowerCase()] || env.browserName.slice(0, 4);
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

	_render(omitLogs?: boolean) {
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
			for (const key in this.reporters) {
				this._drawSessionReporter(this.reporters[key]);
			}
		}

		if (!omitLogs && logLength > 0 && this.log.length) {
			const allowed: { [key: string]: boolean; } = { '×': true, '⚠': true, '!': true };
			const logs = this.log.filter(function (line) {
				return allowed[line.charAt(0)];
			}).slice(-logLength).map(function (line) {
				// truncate long lines
				const color = this.colorReplacement[line.charAt(0)] || ASCII_COLOR.reset;
				line = line.split('\n', 1)[0];
				return color + line.slice(0, this.dimensions.width) + ASCII_COLOR.reset;
			}, this).join('\n');
			charm.write('\n');
			charm.write(logs);
		}
	}

	_drawTotalReporter(report: Report) {
		const charm = this.charm;
		const title = 'Total: ';
		const totalTextSize = String(report.numTotal).length;

		charm.write(title);
		this._drawProgressBar(report, this.dimensions.width - title.length);
		charm.write(format('\nPassed: %s  Failed: %s  Skipped: %d\n',
			fit(String(report.numPassed), totalTextSize), fit(String(report.numFailed), totalTextSize), report.numSkipped));
	}
}
