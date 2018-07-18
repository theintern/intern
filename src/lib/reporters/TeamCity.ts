import Reporter, { eventHandler } from './Reporter';
import Test from '../Test';
import Suite, { isSuite } from '../Suite';

/**
 * This reporter enables Intern to interact with TeamCity.
 * http://confluence.jetbrains.com/display/TCD8/Build+Script+Interaction+with+TeamCity
 *
 * Portions of this module are based on functions from
 * teamcity-service-messages:
 * https://github.com/pifantastic/teamcity-service-messages.
 */
export default class TeamCity extends Reporter {
  _ignoredTestIds:
    | { [sessionId: string]: { [testId: string]: boolean } }
    | undefined;

  @eventHandler()
  runStart() {
    this._ignoredTestIds = {};
  }

  @eventHandler()
  testStart(test: Test) {
    this._sendMessage('testStarted', {
      name: test.name,
      flowId: test.sessionId
    });
  }

  @eventHandler()
  testEnd(test: Test) {
    if (test.error) {
      const message: any = {
        name: test.name,
        message: this.formatError(test.error),
        flowId: test.sessionId
      };

      if (test.error.actual && test.error.expected) {
        message.type = 'comparisonFailure';
        message.expected = test.error.expected;
        message.actual = test.error.actual;
      }

      this._sendMessage('testFailed', message);
    } else if (test.skipped) {
      this._sendMessage('testIgnored', {
        name: test.name,
        flowId: test.sessionId
      });
    } else {
      this._sendMessage('testFinished', {
        name: test.name,
        duration: test.timeElapsed,
        flowId: test.sessionId
      });
    }
  }

  @eventHandler()
  suiteStart(suite: Suite) {
    this._sendMessage('testSuiteStarted', {
      name: suite.name,
      startDate: new Date(),
      flowId: suite.sessionId
    });
  }

  @eventHandler()
  suiteEnd(suite: Suite) {
    if (suite.error) {
      this._sendMessage('message', {
        name: suite.name,
        flowId: suite.sessionId,
        text: 'SUITE ERROR',
        errorDetails: this.formatError(suite.error),
        status: 'ERROR'
      });

      this._notifyUnrunTests(suite);
    } else {
      this._sendMessage('testSuiteFinished', {
        name: suite.name,
        duration: suite.timeElapsed,
        flowId: suite.sessionId
      });
    }
  }

  /**
   * Escape a string for TeamCity output.
   *
   * @param  {string} string
   * @return {string}
   *
   * Based on Message.prototype.escape from teamcity-service-messages
   */
  private _escapeString(str: string): string {
    const replacer = /['\n\r\|\[\]\u0100-\uffff]/g;
    const map = {
      "'": "|'",
      '|': '||',
      '\n': '|n',
      '\r': '|r',
      '[': '|[',
      ']': '|]'
    };

    return str.replace(replacer, function(character: string): string {
      if (character in map) {
        return (<{ [key: string]: any }>map)[character];
      }
      if (/[^\u0000-\u00ff]/.test(character)) {
        return '|0x' + character.charCodeAt(0).toString(16);
      }
      return '';
    });
  }

  private _notifyUnrunTests(suite: Suite) {
    // Keep track of test IDs that have already been ignored for a given
    // session. This prevents the reporter from emitting duplicate
    // testIgnored messages for unrun tests in nested suites as parent
    // suites are finished.
    const ignoredTestIds = this._ignoredTestIds!;
    let ignoredTests = ignoredTestIds![suite.sessionId];
    if (!ignoredTests) {
      ignoredTests = ignoredTestIds![suite.sessionId] = {};
    }

    suite.tests.forEach(test => {
      if (isSuite(test)) {
        this._notifyUnrunTests(test);
      } else if (!ignoredTests[test.id]) {
        this._sendMessage('testIgnored', {
          name: test.name,
          flowId: test.sessionId
        });
        ignoredTests[test.id] = true;
      }
    });
  }

  /**
   * Output a TeamCity message.
   *
   * @param  {string} type
   * @param  {Object}  args
   *
   * Based on Message.prototype.formatArgs from teamcity-service-messages
   */
  private _sendMessage(type: string, args: any): void {
    args.timestamp = new Date().toISOString().slice(0, -1);
    args = Object.keys(args)
      .map(key => `${key}='${this._escapeString(String(args[key]))}'`)
      .join(' ');

    this.output.write(`##teamcity[${type} ${args}]\n`);
  }
}
