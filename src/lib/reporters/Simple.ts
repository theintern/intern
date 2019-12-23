import Suite from '../Suite';
import Test from '../Test';
import TextCoverage from './TextCoverage';
import { eventHandler } from './Reporter';

/**
 * The Simple reporter outputs to the terminal console.
 */
export default class Simple extends TextCoverage {
  @eventHandler()
  error(error: Error) {
    this.console.error(this.formatError(error));
  }

  @eventHandler()
  log(message: string) {
    message.split('\n').forEach(line => {
      this.console.log(`DEBUG: ${line}`);
    });
  }

  @eventHandler()
  suiteEnd(suite: Suite) {
    if (suite.error) {
      this.console.warn('SUITE ERROR');
      this.console.error(this.formatError(suite.error));
    } else {
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
      this.console.error(this.formatError(test.error, { space: '  ' }));
    } else if (test.skipped) {
      this.console.log(`SKIP: ${test.id} (${test.skipped})`);
    } else {
      this.console.log(`PASS: ${test.id} (${test.timeElapsed}ms)`);
    }
  }
}
