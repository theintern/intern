import Suite from '../Suite';
import Test from '../Test';
import Coverage from './Coverage';
import { CoverageMessage } from '../executors/Executor';
import { eventHandler } from './Reporter';

/**
 * The Simple reporter outputs to the terminal console.
 */
export default class Simple extends Coverage {
	@eventHandler()
	error(error: Error) {
		this.console.error(this.formatter.format(error));
	}

	@eventHandler()
	log(message: string) {
		message.split('\n').forEach(line => {
			console.log(`DEBUG: ${line}`);
		});
	}

	@eventHandler()
	suiteEnd(suite: Suite) {
		if (suite.error) {
			this.console.warn('SUITE ERROR');
			this.console.error(this.formatter.format(suite.error));
		}
		else {
			const numTests = suite.numTests;
			const numFailedTests = suite.numFailedTests;
			const numSkippedTests = suite.numSkippedTests;
			let message = `${numFailedTests}/${numTests} tests failed`;
			if (suite.name) {
				message += ` in ${suite.name}`;
			}

			if (numSkippedTests > 0) {
				message += ` (${numSkippedTests} skipped)`;
			}

			this.console[numFailedTests ? 'warn' : 'info'](message);
		}
	}

	@eventHandler()
	testEnd(test: Test) {
		if (test.error) {
			this.console.error(`FAIL: ${test.id} (${test.timeElapsed}ms)`);
			this.console.error(this.formatter.format(test.error, { space: '  ' }));
		}
		else if (test.skipped) {
			this.console.log(`SKIP: ${test.id} (${test.skipped})`);
		}
		else {
			this.console.log(`PASS: ${test.id} (${test.timeElapsed}ms)`);
		}
	}

	@eventHandler()
	coverage(data: CoverageMessage) {
		// add a newline between test results and coverage results for prettier output
		this.console.log('');
		this.createCoverageReport('text', data.coverage);
	}
}
