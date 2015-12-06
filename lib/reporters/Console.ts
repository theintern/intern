import * as util from '../util';
import has = require('dojo/has');
import { Coverage } from 'istanbul/lib/instrumenter';
import { Reporter, ReporterKwArgs } from '../ReporterManager';
import Suite from '../Suite';
import Test from '../Test';

import _CollectorType = require('istanbul/lib/collector');
import _TextReporterType = require('istanbul/lib/report/text');
if (has('host-node')) {
	/* tslint:disable:no-var-keyword */
	var Collector: typeof _CollectorType = require('istanbul/lib/collector');
	var TextReporter: typeof _TextReporterType = require('istanbul/lib/report/text');
	/* tslint:enable:no-var-keyword */
}

/**
 * The console reporter outputs to the current environment's console.
 */
export default class ConsoleReporter implements Reporter {
	protected console: Console;
	protected hasGrouping: boolean;
	protected testId: string;
	private _coverageReporter: _TextReporterType;

	constructor(config: ReporterKwArgs = {}) {
		this.console = config.console;
		this.hasGrouping = 'group' in this.console && 'groupEnd' in this.console;
		this.testId = this.hasGrouping ? 'name' : 'id';

		if (has('host-node')) {
			this._coverageReporter = new TextReporter({
				watermarks: config.watermarks
			});
		}
	}

	coverage(sessionId: string, coverage: Coverage) {
		if (has('host-node')) {
			const collector = new Collector();
			collector.add(coverage);

			// add a newline between test results and coverage results for prettier output
			this.console.log('');
			this._coverageReporter.writeReport(collector, true);
		}
	}

	deprecated(name: string, replacement: string, extra: string) {
		this.console.warn(name + ' is deprecated.' +
			(replacement ?
				' Use ' + replacement + ' instead.' :
				' Please open a ticket at https://github.com/theintern/intern/issues if you still require access ' +
				'to this feature.') +
			(extra ? ' ' + extra : '')
		);
	}

	fatalError(error: Error) {
		this.console.warn('FATAL ERROR');
		this.console.error(util.getErrorMessage(error));
	}

	reporterError(reporter: Reporter, error: Error) {
		this.console.error('REPORTER ERROR');
		this.console.error(util.getErrorMessage(error));
	}

	suiteEnd(suite: Suite) {
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

		if (numFailedTests) {
			this.console.warn(message);
		}
		else {
			this.console.info(message);
		}

		this.hasGrouping && this.console.groupEnd();
	}

	suiteError(suite: Suite) {
		if (!this.console) {
			return;
		}
		this.console.warn('SUITE ERROR');
		this.console.error(util.getErrorMessage(suite.error));
	}

	suiteStart(suite: Suite) {
		// only start group for non-root suite
		this.hasGrouping && suite.hasParent && this.console.group(suite.name);
	}

	testFail(test: Test) {
		this.console.error('FAIL: ' + (<any> test)[this.testId] + ' (' + test.timeElapsed + 'ms)');
		this.console.error(util.getErrorMessage(test.error));
	}

	testPass(test: Test) {
		this.console.log('PASS: ' + (<any> test)[this.testId] + ' (' + test.timeElapsed + 'ms)');
	}

	testSkip(test: Test) {
		this.console.log('SKIP: ' + (<any> test)[this.testId] + (test.skipped ? ' (' + test.skipped + ')' : ''));
	}
}
