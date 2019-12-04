import { Executor } from '../executors/Executor';
import Suite from '../Suite';
import Test from '../Test';
import Reporter, { eventHandler, ReporterOptions } from './Reporter';

/**
 * The console reporter outputs to the browser console.
 */
export default class ConsoleReporter extends Reporter {
  private _hasGrouping: boolean;
  private _testId: keyof Test;

  constructor(executor: Executor, options: ReporterOptions = {}) {
    super(executor, options);
    this._hasGrouping = 'group' in this.console && 'groupEnd' in this.console;
    this._testId = this._hasGrouping ? 'name' : 'id';
  }

  @eventHandler()
  error(error: Error) {
    this.console.warn('FATAL ERROR');
    this.console.error(this.formatError(error));
  }

  @eventHandler()
  suiteEnd(suite: Suite) {
    // IE<10 does not provide a global console object when Developer Tools
    // is turned off
    if (!this.console) {
      return;
    }

    if (suite.error) {
      this.console.warn('SUITE ERROR');
      this.console.error(this.formatError(suite.error));
    } else {
      const numTests = suite.numTests;
      const numFailedTests = suite.numFailedTests;
      const numSkippedTests = suite.numSkippedTests;
      const numNotRunTests =
        numTests - (suite.numPassedTests + numFailedTests + numSkippedTests);
      let message = numFailedTests + '/' + numTests + ' tests failed';

      if (numSkippedTests + numNotRunTests > 0) {
        message += ` (${numSkippedTests + numNotRunTests} not run)`;
      }

      this.console[numFailedTests ? 'warn' : 'info'](message);
    }

    this._hasGrouping && this.console.groupEnd();
  }

  @eventHandler()
  suiteStart(suite: Suite) {
    // only start group for non-root suite
    this._hasGrouping && suite.hasParent && this.console.group(suite.name);
  }

  @eventHandler()
  testEnd(test: Test) {
    if (test.error) {
      this.console.error(`FAIL: ${test[this._testId]} (${test.timeElapsed}ms)`);
      this.console.error(this.formatError(test.error));
    } else if (test.skipped) {
      this.console.log(`SKIP: ${test[this._testId]} (${test.skipped})`);
    } else {
      this.console.log(`PASS: ${test[this._testId]} (${test.timeElapsed}ms)`);
    }
  }
}
