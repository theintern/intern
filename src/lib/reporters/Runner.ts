import * as charm from 'charm';
import Test from '../Test';
import Suite from '../Suite';
import { createEventHandler } from './Reporter';
import Coverage, { CoverageProperties } from './Coverage';
import { createCoverageMap, CoverageMap } from 'istanbul-lib-coverage';
import { Writable } from 'stream';
import Server from '../Server';
import { CoverageMessage, DeprecationMessage } from '../executors/Executor';
import Node, { Events, TunnelMessage } from '../executors/Node';
import { prefix } from '../common/util';

export type Charm = charm.CharmInstance;

const eventHandler = createEventHandler<Events>();

export default class Runner extends Coverage implements RunnerProperties {
	sessions: {
		[sessionId: string]: {
			coverage?: CoverageMap;
			suite: Suite;
			[key: string]: any;
		}
	};

	hasRunErrors: boolean;
	hasSuiteErrors: boolean;
	hidePassed: boolean;
	hideSkipped: boolean;
	serveOnly: boolean;

	private _deprecationMessages: { [message: string]: boolean };

	protected charm: Charm;

	constructor(executor: Node, options: Partial<RunnerProperties> = {}) {
		super(executor, options);

		this.hidePassed = options.hidePassed || false;
		this.hideSkipped = options.hideSkipped || false;

		this.sessions = {};
		this.hasRunErrors = false;
		this.hasSuiteErrors = false;
		this.serveOnly = executor.config.serveOnly;

		this.charm = charm();
		this.charm.pipe(<Writable>this.output);
		this.charm.display('reset');

		this._deprecationMessages = {};
	}

	@eventHandler()
	coverage(message: CoverageMessage) {
		const session = this.sessions[message.sessionId || ''];
		session.coverage = session.coverage || createCoverageMap();
		session.coverage.merge(message.coverage);
	}

	@eventHandler()
	deprecated(message: DeprecationMessage) {
		// Keep track of deprecation messages we've seen before
		const key = `${message.original}|${message.replacement}|${message.message}`;
		if (this._deprecationMessages[key]) {
			return;
		}
		this._deprecationMessages[key] = true;

		this.charm
			.foreground('yellow')
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

		this.charm.write('\n');
		this.charm.display('reset');
	}

	@eventHandler()
	error(error: Error) {
		this.charm.foreground('red');
		this.charm.write('(ノಠ益ಠ)ノ彡┻━┻\n');
		this.charm.write(this.formatError(error));
		this.charm.display('reset');
		this.charm.write('\n\n');
		this.hasRunErrors = true;
	}

	@eventHandler()
	warning(warning: string | Error) {
		this.charm.foreground('yellow');
		const message = typeof warning === 'string' ? warning : this.formatError(warning);
		this.charm.write(`WARNING: ${message.replace(/^Error:\s+/, '')}`);
		this.charm.display('reset');
		this.charm.write('\n\n');
	}

	@eventHandler()
	log(message: string) {
		message.split('\n').forEach(line => {
			this.console.log(`DEBUG: ${line}`);
		});
	}

	@eventHandler()
	runEnd() {
		let map = createCoverageMap();
		let numTests = 0;
		let numFailedTests = 0;
		let numSkippedTests = 0;

		const sessionIds = Object.keys(this.sessions);
		const numEnvironments = sessionIds.length;

		if (sessionIds.length > 1) {
			sessionIds.forEach(sessionId => {
				const session = this.sessions[sessionId];
				if (session.coverage) {
					map.merge(session.coverage);
				}
				numTests += session.suite.numTests;
				numFailedTests += session.suite.numFailedTests;
				numSkippedTests += session.suite.numSkippedTests;
			});

			const charm = this.charm;

			if (map.files().length > 0) {
				charm.write('\n');
				charm.display('bright');
				charm.write('Total coverage\n');
				charm.display('reset');
				this.createCoverageReport(this.reportType, map);
			}

			const numPassedTests = numTests - numFailedTests - numSkippedTests;
			let message = `TOTAL: tested ${numEnvironments} platforms, ${numPassedTests} passed, ${numFailedTests} failed`;

			if (numSkippedTests) {
				message += `, ${numSkippedTests} skipped`;
			}

			if (this.hasRunErrors) {
				message += '; fatal error occurred';
			}
			else if (this.hasSuiteErrors) {
				message += '; suite error occurred';
			}

			charm.display('bright');
			charm.foreground(numFailedTests > 0 || this.hasRunErrors || this.hasSuiteErrors ? 'red' : 'green');
			charm.write(message);
			charm.display('reset');
			charm.write('\n');
		}
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
		const session = this.sessions[suite.sessionId || ''];
		if (!session) {
			if (!this.serveOnly) {
				const charm = this.charm;
				charm.display('bright');
				charm.foreground('yellow');
				charm.write('BUG: suiteEnd was received for invalid session ' + suite.sessionId);
				charm.display('reset');
				charm.write('\n');
			}

			return;
		}

		if (suite.error) {
			const error = suite.error;
			const charm = this.charm;

			charm.foreground('red');
			charm.write('Suite ' + suite.id + ' FAILED\n');
			charm.write(this.formatError(error));
			charm.display('reset');
			charm.write('\n');

			session.hasSuiteErrors = true;
		}
		else if (!suite.hasParent) {
			if (session.coverage) {
				this.charm.write('\n');
				this.createCoverageReport(this.reportType, session.coverage);
			}
			else {
				const charm = this.charm;
				charm.write('No unit test coverage for ' + suite.name);
				charm.display('reset');
				charm.write('\n');
			}

			const name = suite.name;
			const hasError = suite.error || session.hasSuiteErrors;
			const numTests = suite.numTests;
			const numFailedTests = suite.numFailedTests;
			const numSkippedTests = suite.numSkippedTests;
			const numPassedTests = numTests - numFailedTests - numSkippedTests;

			let summary = `${name}: ${numPassedTests} passed, ${numFailedTests} failed`;
			if (numSkippedTests) {
				summary += `, ${numSkippedTests} skipped`;
			}

			if (hasError) {
				summary += '; suite error occurred';
			}

			const charm = this.charm;
			charm.display('bright');
			charm.foreground(numFailedTests || hasError > 0 ? 'red' : 'green');
			charm.write(summary);
			charm.display('reset');
			charm.write('\n');
		}
	}

	@eventHandler()
	suiteStart(suite: Suite) {
		if (!suite.hasParent) {
			this.sessions[suite.sessionId || ''] = { suite: suite };
			if (suite.sessionId) {
				this.charm.write('\n');
				this.charm.write('‣ Created remote session ' + suite.name + ' (' + suite.sessionId + ')\n');
			}
		}
	}

	@eventHandler()
	testEnd(test: Test) {
		const charm = this.charm;
		if (test.error) {
			charm.foreground('red');
			charm.write('× ' + test.id);
			charm.write(' (' + (test.timeElapsed / 1000) + 's)');
			charm.write('\n');
			charm.write(prefix(this.formatError(test.error), '    '));
			charm.display('reset');
			charm.write('\n\n');
		}
		else if (test.skipped) {
			if (!this.hideSkipped) {
				charm.write('~ ' + test.id);
				charm.display('reset');
				charm.write(' (' + (test.skipped || 'skipped') + ')');
				charm.display('reset');
				charm.write('\n');
			}
		}
		else {
			if (!this.hidePassed) {
				charm.foreground('green');
				charm.write('✓ ' + test.id);
				charm.display('reset');
				charm.write(' (' + (test.timeElapsed / 1000) + 's)');
				charm.display('reset');
				charm.write('\n');
			}
		}
	}

	@eventHandler()
	tunnelDownloadProgress(message: TunnelMessage) {
		const progress = message.progress!;
		this.charm.write('Tunnel download: ' + (progress.received / progress.total * 100).toFixed(3) + '%\r');
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

export interface RunnerProperties extends CoverageProperties {
	hidePassed: boolean;
	hideSkipped: boolean;
}
