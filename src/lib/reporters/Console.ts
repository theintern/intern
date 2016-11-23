import * as util from '../util';
import * as has from 'dojo/has';
import { Suite } from '../Suite';
import { Test } from '../Test';
import Collector = require('dojo/has!host-node?dojo/node!istanbul/lib/collector');
import TextReporter = require('dojo/has!host-node?dojo/node!istanbul/lib/report/text');
import { Reporter, ReporterConfig } from '../../interfaces';

/**
 * The console reporter outputs to the current environment's console.
 */
export class Console implements Reporter {
	console: any; // TODO: fix
	hasGrouping: boolean;
	testId: string;
	private _coverageReporter: TextReporter;

	constructor(config: ReporterConfig = {}) {
		this.console = config.console;
		this.hasGrouping = 'group' in this.console && 'groupEnd' in this.console;
		this.testId = this.hasGrouping ? 'name' : 'id';

		if (has('host-node')) {
			this._coverageReporter = new TextReporter({
				watermarks: config.watermarks
			});
		}
	}

	deprecated(name: string, replacement: string, extra: string): void {
		this.console.warn(name + ' is deprecated.' +
			(replacement ?
				' Use ' + replacement + ' instead.' :
				' Please open a ticket at https://github.com/theintern/intern/issues if you still require access ' +
				'to this feature.') +
			(extra ? ' ' + extra : '')
		);
	}

	fatalError(error: Error): void {
		this.console.warn('FATAL ERROR');
		this.console.error(util.getErrorMessage(error));
	}

	reporterError(reporter: Reporter, error: Error): void {
		this.console.error('REPORTER ERROR');
		this.console.error(util.getErrorMessage(error));
	}

	suiteEnd(suite: Suite): void {
		// IE<10 does not provide a global console object when Developer Tools is turned off
		if (!this.console) {
			return;
		}

		const numTests = suite.numTests;
		const numFailedTests = suite.numFailedTests;
		const numSkippedTests = suite.numSkippedTests;
		let message = numFailedTests + '/' + numTests + ' tests failed';

		if (numSkippedTests > 0) {
			message += ' (' + numSkippedTests + ' skipped)';
		}

		this.console[numFailedTests ? 'warn' : 'info'](message);
		this.hasGrouping && this.console.groupEnd(suite.name);
	}

	suiteError(suite: Suite): void {
		if (!this.console) {
			return;
		}
		this.console.warn('SUITE ERROR');
		this.console.error(util.getErrorMessage(suite.error));
	}

	suiteStart(suite: Suite): void {
		// only start group for non-root suite
		this.hasGrouping && suite.hasParent && this.console.group(suite.name);
	}

	testFail(test: Test): void {
		this.console.error('FAIL: ' + (<{ [key: string]: any }> test)[this.testId] + ' (' + test.timeElapsed + 'ms)');
		this.console.error(util.getErrorMessage(test.error));
	}

	testPass(test: Test): void {
		this.console.log('PASS: ' + (<{ [key: string]: any }> test)[this.testId] + ' (' + test.timeElapsed + 'ms)');
	}

	testSkip(test: Test): void {
		this.console.log('SKIP: ' + (<{ [key: string]: any }> test)[this.testId] + (test.skipped ? ' (' + test.skipped + ')' : ''));
	}

	coverage(sessionId: string, coverage: Object): void {
		if (!has('host-node')) {
			return;
		}
		const collector = new Collector();
		collector.add(coverage);

		// add a newline between test results and coverage results for prettier output
		this.console.log('');
		this._coverageReporter.writeReport(collector, true);
	}
}
