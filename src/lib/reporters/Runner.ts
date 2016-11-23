import * as charm from 'dojo/node!charm';
import * as nodeUtil from 'dojo/node!util';
import Collector = require('dojo/has!host-node?dojo/node!istanbul/lib/collector');
import TextSummaryReport = require('dojo/has!host-node?dojo/node!istanbul/lib/report/text-summary');
import TextReport = require('dojo/has!host-node?dojo/node!istanbul/lib/report/text');
import * as intern from '../../main';
import * as util from '../util';
import { Test } from '../Test';
import { Suite } from '../Suite';
import { Reporter, ReporterConfig, Config, Proxy } from '../../interfaces';
import { Writable } from 'stream';
import * as Tunnel from 'digdug/Tunnel';

const LIGHT_RED = '\x1b[91m';
const LIGHT_GREEN = '\x1b[92m';
const LIGHT_YELLOW = '\x1b[93m';
const LIGHT_MAGENTA = '\x1b[95m';
export type Charm = charm.Charm;

export interface RunnerConfig extends ReporterConfig {
	internConfig?: Config;
}

export class Runner {
	sessions: { [sessionId: string]: any };
	hasErrors: boolean;
	proxyOnly: boolean;
	reporter: TextSummaryReport;
	detailedReporter: TextReport;
	charm: Charm;

	constructor(config: RunnerConfig = {}) {
		this.sessions = {};
		this.hasErrors = false;
		this.proxyOnly = Boolean(config.internConfig.proxyOnly);
		this.reporter = new TextSummaryReport({
			watermarks: config.watermarks
		});
		this.detailedReporter = new TextReport({
			watermarks: config.watermarks
		});

		this.charm = charm();
		this.charm.pipe(<Writable> config.output);
		this.charm.display('reset');
	}

	coverage(sessionId: string, coverage: Object): void {
		// coverage will be called for the runner host, which has no session ID -- ignore that
		if (intern.mode === 'client' || sessionId) {
			const session = this.sessions[sessionId || ''];
			session.coverage = session.coverage || new Collector();
			session.coverage.add(coverage);
		}
	}

	deprecated(name: string, replacement: string, extra: string): void {
		this.charm
			.write(LIGHT_YELLOW)
			.write('⚠︎ ' + name + ' is deprecated. ');

		if (replacement) {
			this.charm.write('Use ' + replacement + ' instead.');
		}
		else {
			this.charm.write('Please open a ticket at https://github.com/theintern/intern/issues if you still ' +
				'require access to this function.');
		}

		if (extra) {
			this.charm.write(' ' + extra);
		}

		this.charm.write('\n').display('reset');
	}

	fatalError(error: Error): void {
		this.charm
			.foreground('red')
			.write('(ノಠ益ಠ)ノ彡┻━┻\n')
			.write(util.getErrorMessage(error))
			.display('reset')
			.write('\n');

		this.hasErrors = true;
	}

	proxyStart(proxy: Proxy): void {
		this.charm.write('Listening on 0.0.0.0:' + proxy.config.port + '\n');
	}

	reporterError(reporter: Reporter, error: Error): void {
		this.charm
			.foreground('red')
			.write('Reporter error!\n')
			.write(util.getErrorMessage(error))
			.display('reset')
			.write('\n');
	}

	runEnd(): void {
		let collector = new Collector();
		let numEnvironments = 0;
		let numTests = 0;
		let numFailedTests = 0;
		let numSkippedTests = 0;

		for (let sessionId in this.sessions) {
			let session = this.sessions[sessionId];
			session.coverage && collector.add(session.coverage.getFinalCoverage());
			++numEnvironments;
			numTests += session.suite.numTests;
			numFailedTests += session.suite.numFailedTests;
			numSkippedTests += session.suite.numSkippedTests;
		}

		// add a newline between test results and coverage results for prettier output
		this.charm.write('\n');

		if (collector.files().length > 0) {
			this.detailedReporter.writeReport(collector);
		}

		let message = 'TOTAL: tested %d platforms, %d/%d tests failed';

		if (numSkippedTests) {
			message += ' (' + numSkippedTests + ' skipped)';
		}

		if (this.hasErrors && !numFailedTests) {
			message += '; fatal error occurred';
		}

		this.charm
			.display('bright')
			.foreground(numFailedTests > 0 || this.hasErrors ? 'red' : 'green')
			.write(nodeUtil.format(message, numEnvironments, numFailedTests, numTests))
			.display('reset')
			.write('\n');
	}

	suiteEnd(suite: Suite): void {
		if (!suite.hasParent) {
			// runEnd will report all of this information, so do not repeat it
			if (intern.mode === 'client') {
				return;
			}

			// Runner mode test with no sessionId was some failed test, not a bug
			if (!suite.sessionId) {
				return;
			}

			if (!this.sessions[suite.sessionId]) {
				if (!this.proxyOnly) {
					this.charm
						.write(LIGHT_YELLOW)
						.write('BUG: suiteEnd was received for invalid session ' + suite.sessionId)
						.display('reset')
						.write('\n');
				}

				return;
			}

			const session = this.sessions[suite.sessionId];

			if (session.coverage) {
				this.reporter.writeReport(session.coverage);
			}
			else {
				this.charm
					.write('No unit test coverage for ' + suite.name)
					.display('reset')
					.write('\n');
			}

			let name = suite.name;
			let hasError = (function hasError(suite): any {
				return suite.tests ? (suite.error || suite.tests.some(hasError)) : false;
			})(suite);
			let numFailedTests = suite.numFailedTests;
			let numTests = suite.numTests;
			let numSkippedTests = suite.numSkippedTests;

			let summary = nodeUtil.format('%s: %d/%d tests failed', name, numFailedTests, numTests);
			if (numSkippedTests) {
				summary += ' (' + numSkippedTests + ' skipped)';
			}

			if (hasError) {
				summary += '; fatal error occurred';
			}

			this.charm
				.write(numFailedTests || hasError > 0 ? LIGHT_RED : LIGHT_GREEN)
				.write(summary)
				.display('reset')
				.write('\n\n');
		}
	}

	suiteError(suite: Suite): void {
		const error = suite.error;

		this.charm
			.foreground('red')
			.write('Suite ' + suite.id + ' FAILED\n')
			.write(util.getErrorMessage(error))
			.display('reset')
			.write('\n');

		this.hasErrors = true;
	}

	suiteStart(suite: Suite): void {
		if (!suite.hasParent) {
			this.sessions[suite.sessionId || ''] = { suite: suite };
			if (suite.sessionId) {
				this.charm.write('‣ Created session ' + suite.name + ' (' + suite.sessionId + ')\n');
			}
		}
	}

	testFail(test: Test): void {
		this.charm
			.write(LIGHT_RED)
			.write('× ' + test.id)
			.write(' (' + (test.timeElapsed / 1000) + 's)')
			.write('\n')
			.foreground('red')
			.write(util.getErrorMessage(test.error))
			.display('reset')
			.write('\n');
	}

	testPass(test: Test): void {
		this.charm
			.write(LIGHT_GREEN)
			.write('✓ ' + test.id)
			.foreground('white')
			.write(' (' + (test.timeElapsed / 1000) + 's)')
			.display('reset')
			.write('\n');
	}

	testSkip(test: Test): void {
		this.charm
			.write(LIGHT_MAGENTA)
			.write('~ ' + test.id)
			.foreground('white')
			.write(' (' + (test.skipped || 'skipped') + ')')
			.display('reset')
			.write('\n');
	}

	tunnelDownloadProgress(tunnel: Tunnel, progress: { loaded: number, total: number }) {
		this.charm.write('Tunnel download: ' + (progress.loaded / progress.total * 100).toFixed(3) + '%\r');
	}

	tunnelStart(): void {
		this.charm.write('Tunnel started\n');
	}

	tunnelStatus(tunnel: Tunnel, status: string): void {
		this.charm.write(status + '\x1b[K\r');
	}
}
