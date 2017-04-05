import * as charm from 'charm';
import * as nodeUtil from 'util';
import Collector = require('istanbul/lib/collector');
import TextSummaryReport = require('istanbul/lib/report/text-summary');
import TextReport = require('istanbul/lib/report/text');
import Test from '../Test';
import Suite from '../Suite';
import { createEventHandler } from './Reporter';
import Coverage, { CoverageProperties } from './Coverage';
import { Writable } from 'stream';
import Server from '../Server';
import { CoverageMessage, DeprecationMessage } from '../executors/Executor';
import WebDriver, { Events, TunnelMessage } from '../executors/WebDriver';

const LIGHT_RED = '\x1b[91m';
const LIGHT_GREEN = '\x1b[92m';
const LIGHT_YELLOW = '\x1b[93m';
const LIGHT_MAGENTA = '\x1b[95m';
export type Charm = charm.Charm;

const eventHandler = createEventHandler<Events>();

export default class Runner extends Coverage {
	sessions: { [sessionId: string]: any };

	hasErrors: boolean;

	serveOnly: boolean;

	private _summaryReporter: TextSummaryReport;
	private _detailedReporter: TextReport;

	protected charm: Charm;

	constructor(executor: WebDriver, config: Partial<CoverageProperties> = {}) {
		super(executor, config);

		this.sessions = {};
		this.hasErrors = false;
		this.serveOnly = executor.config.serveOnly;
		this._summaryReporter = new TextSummaryReport({
			watermarks: this.watermarks
		});
		this._detailedReporter = new TextReport({
			watermarks: this.watermarks
		});

		this.charm = charm();
		this.charm.pipe(<Writable>this.output);
		this.charm.display('reset');
	}

	@eventHandler()
	coverage(message: CoverageMessage) {
		// coverage will be called for the runner host, which has no session ID -- ignore that
		if (message.sessionId) {
			const session = this.sessions[message.sessionId || ''];
			session.coverage = session.coverage || new Collector();
			session.coverage.add(message.coverage);
		}
	}

	@eventHandler()
	deprecated(message: DeprecationMessage) {
		this.charm
			.write(LIGHT_YELLOW)
			.write('⚠︎ ' + message.original + ' is deprecated. ');

		if (message.replacement) {
			this.charm.write('Use ' + message.replacement + ' instead.');
		}
		else {
			this.charm.write('Please open a ticket at https://github.com/theintern/intern/issues if you still ' +
				'require access to this function.');
		}

		if (message.message) {
			this.charm.write(' ' + message.message);
		}

		this.charm.write('\n').display('reset');
	}

	@eventHandler()
	error(error: Error) {
		this.charm
			.foreground('red')
			.write('(ノಠ益ಠ)ノ彡┻━┻\n')
			.write(this.formatter.format(error))
			.display('reset')
			.write('\n');

		this.hasErrors = true;
	}

	@eventHandler()
	log(message: string) {
		message.split('\n').forEach(line => {
			console.log(`DEBUG: ${line}`);
		});
	}

	@eventHandler()
	runEnd() {
		let collector = new Collector();
		let numTests = 0;
		let numFailedTests = 0;
		let numSkippedTests = 0;

		const sessionIds = Object.keys(this.sessions);
		const numEnvironments = sessionIds.length;

		sessionIds.forEach(sessionId => {
			const session = this.sessions[sessionId];
			if (session.coverage) {
				const finalCoverage = session.coverage.getFinalCoverage();
				collector.add(finalCoverage);
			}
			numTests += session.suite.numTests;
			numFailedTests += session.suite.numFailedTests;
			numSkippedTests += session.suite.numSkippedTests;
		});

		// add a newline between test results and coverage results for prettier output
		this.charm.write('\n');

		if (collector.files().length > 0) {
			this._detailedReporter.writeReport(collector);
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

	@eventHandler()
	serverStart(server: Server) {
		let message = `Listening on localhost:${server.port}`;
		if (server.socketPort) {
			message += ` (ws ${server.socketPort})`;
		}
		this.charm.write(`${message}\n`);
	}

	@eventHandler()
	suiteEnd(suite: Suite) {
		if (suite.error) {
			const error = suite.error;

			this.charm
				.foreground('red')
				.write('Suite ' + suite.id + ' FAILED\n')
				.write(this.formatter.format(error))
				.display('reset')
				.write('\n');

			this.hasErrors = true;
		}
		else if (!suite.hasParent) {
			// Runner mode test with no sessionId was some failed test, not a bug
			if (!suite.sessionId) {
				return;
			}

			if (!this.sessions[suite.sessionId]) {
				if (!this.serveOnly) {
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
				this._summaryReporter.writeReport(session.coverage);
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

	@eventHandler()
	suiteStart(suite: Suite) {
		if (!suite.hasParent) {
			this.sessions[suite.sessionId || ''] = { suite: suite };
			if (suite.sessionId) {
				this.charm.write('‣ Created session ' + suite.name + ' (' + suite.sessionId + ')\n');
			}
		}
	}

	@eventHandler()
	testEnd(test: Test) {
		if (test.error) {
			this.charm
				.write(LIGHT_RED)
				.write('× ' + test.id)
				.write(' (' + (test.timeElapsed / 1000) + 's)')
				.write('\n')
				.foreground('red')
				.write(this.formatter.format(test.error))
				.display('reset')
				.write('\n');
		}
		else if (test.skipped) {
			this.charm
				.write(LIGHT_MAGENTA)
				.write('~ ' + test.id)
				.foreground('white')
				.write(' (' + (test.skipped || 'skipped') + ')')
				.display('reset')
				.write('\n');
		}
		else {
			this.charm
				.write(LIGHT_GREEN)
				.write('✓ ' + test.id)
				.foreground('white')
				.write(' (' + (test.timeElapsed / 1000) + 's)')
				.display('reset')
				.write('\n');
		}
	}

	@eventHandler()
	tunnelDownloadProgress(message: TunnelMessage) {
		this.charm.write('Tunnel download: ' + (message.progress.received / message.progress.total * 100).toFixed(3) + '%\r');
	}

	@eventHandler()
	tunnelStart() {
		this.charm.write('Tunnel started\n');
	}

	@eventHandler()
	tunnelStatus(message: TunnelMessage) {
		this.charm.write(message.status + '\x1b[K\r');
	}
}
