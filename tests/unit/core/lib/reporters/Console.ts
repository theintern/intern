import Suite from 'src/core/lib/Suite';
import Test from 'src/core/lib/Test';
import ConsoleReporter from 'src/core/lib/reporters/Console';
import { createMockConsole } from 'tests/support/unit/mocks';

const mockExecutor = <any>{
  on() {},
  emit() {},
  formatError(error: Error) {
    return error.stack || error.message;
  }
};

registerSuite('src/core/lib/reporters/Console', {
  tests: {
    error() {
      const mockConsole = createMockConsole();
      const reporter = new ConsoleReporter(mockExecutor, {
        console: <any>mockConsole
      });
      const error = new Error('Oops');

      reporter.error(error);

      assert.equal(
        mockConsole.warn.callCount,
        1,
        'console.warn should be called once for a fatal error'
      );
      assert.equal(
        mockConsole.error.callCount,
        1,
        'console.error should be called once for a fatal error'
      );

      const result =
        mockConsole.warn.args[0][0] + '\n' + mockConsole.error.args[0][0];
      assert.match(
        result,
        /\bFATAL ERROR\b/,
        'Reporter should indicate that a fatal error occurred'
      );
    },

    suiteStart() {
      const mockConsole = createMockConsole(true);
      const reporter = new ConsoleReporter(mockExecutor, {
        console: <any>mockConsole
      });
      const suite = new Suite(<any>{ name: 'suite', parent: {} });

      reporter.suiteStart(suite);
      assert.equal(
        mockConsole.group.callCount,
        1,
        'console.group should be called when the reporter suiteStart method is called'
      );
      assert.strictEqual(
        mockConsole.group.args[0][0],
        suite.name,
        'console.group should be called with the name of the suite'
      );
    },

    suiteEnd: {
      pass() {
        const mockConsole = createMockConsole();
        const reporter = new ConsoleReporter(mockExecutor, {
          console: <any>mockConsole
        });
        const suite = new Suite({
          executor: mockExecutor,
          name: 'suite',
          tests: [
            new Test({
              name: 'foo',
              test: () => {},
              hasPassed: true
            }),
            new Test({
              name: 'foo skipped',
              test: () => {},
              skipped: 'yes'
            })
          ]
        });

        reporter.suiteEnd(suite);
        assert.equal(
          mockConsole.info.callCount,
          1,
          'console.info should be called when the reporter suiteEnd method is ' +
            'called and there are no errors'
        );
        assert.match(
          mockConsole.info.args[0][0],
          new RegExp('^' + suite.numFailedTests + '/' + suite.numTests + ' '),
          'console.info message should say how many tests failed and how many total tests existed'
        );
      },

      fail() {
        const mockConsole = createMockConsole();
        const reporter = new ConsoleReporter(mockExecutor, {
          console: <any>mockConsole
        });
        const suite = new Suite({
          executor: mockExecutor,
          name: 'suite',
          tests: [
            new Test({
              name: 'foo',
              test: () => {},
              hasPassed: false
            })
          ]
        });
        suite.error = new Error('failed');

        reporter.suiteEnd(suite);
        assert.equal(
          mockConsole.warn.callCount,
          1,
          'console.warn should be called when the reporter SuiteEnd method is ' +
            'called and there are errors'
        );
        assert.include(
          mockConsole.warn.args[0][0],
          'SUITE ERROR',
          'console.warn message should indicate a suite failure'
        );
      },

      'failing test'() {
        const mockConsole = createMockConsole();
        const reporter = new ConsoleReporter(mockExecutor, {
          console: <any>mockConsole
        });
        const suite = new Suite({
          executor: mockExecutor,
          name: 'suite',
          tests: [
            new Test({
              name: 'foo',
              test: () => {}
            })
          ]
        });
        suite.tests[0].error = new Error('foo');

        reporter.suiteEnd(suite);
        assert.equal(
          mockConsole.warn.callCount,
          1,
          'console.warn should be called when the reporter SuiteEnd method is ' +
            'called and there are errors'
        );
        assert.match(
          mockConsole.warn.args[0][0],
          new RegExp('^' + suite.numFailedTests + '/' + suite.numTests + ' '),
          'console.warn message should say how many tests passed and how many total tests existed'
        );
      },

      grouping() {
        const mockConsole = createMockConsole(true);
        const reporter = new ConsoleReporter(mockExecutor, {
          console: <any>mockConsole
        });
        const suite = new Suite({
          executor: mockExecutor,
          name: 'suite'
        });

        reporter.suiteEnd(suite);
        assert.equal(
          mockConsole.groupEnd.callCount,
          1,
          'console.groupEnd should be called when the reporter suiteEnd method is called'
        );
      }
    },

    testEnd: {
      pass() {
        const mockConsole = createMockConsole();
        const reporter = new ConsoleReporter(mockExecutor, {
          console: <any>mockConsole
        });
        const test = new Test({
          name: 'test',
          timeElapsed: 123,
          test: () => {},
          parent: <any>{ name: 'parent', id: 'parent' },
          hasPassed: true
        });

        reporter.testEnd(test);
        assert.equal(
          mockConsole.log.callCount,
          1,
          'console.log should ahve been called once for testPass'
        );

        const message = mockConsole.log.args[0][0];
        assert.match(
          message,
          /\bPASS\b/,
          'Reporter should indicate that a test passed'
        );
        assert.include(
          message,
          test.name,
          'Reporter should indicate which test passed'
        );
        assert.include(
          message,
          test.timeElapsed + 'ms',
          'Reporter should indicate the amount of time the test took'
        );
      },

      fail() {
        const mockConsole = createMockConsole();
        const reporter = new ConsoleReporter(mockExecutor, {
          console: <any>mockConsole
        });
        const test = new Test({
          name: 'test',
          timeElapsed: 123,
          test: () => {},
          parent: <any>{ name: 'parent', id: 'parent' }
        });
        (<any>test).error = new Error('Oops');

        reporter.testEnd(test);
        assert.equal(
          mockConsole.error.callCount,
          2,
          'console.error should be called twice for a failed test'
        );

        const result = mockConsole.error.args.map(args => args[0]).join('\n');
        assert.match(
          result,
          /\bFAIL\b/,
          'Reporter should indicate that a test failed'
        );
        assert.include(
          result,
          test.id,
          'Reporter should indicate which test failed'
        );
        assert.include(
          result,
          test.timeElapsed + 'ms',
          'Reporter should indicate the amount of time the test took'
        );
      },

      skipped() {
        const mockConsole = createMockConsole();
        const reporter = new ConsoleReporter(mockExecutor, {
          console: <any>mockConsole
        });
        const test = new Test({
          name: 'test',
          skipped: 'yes',
          test: () => {},
          parent: <any>{ name: 'parent', id: 'parent' }
        });

        reporter.testEnd(test);
        assert.equal(
          mockConsole.log.callCount,
          1,
          'console.log should be called once for a skipped test'
        );

        assert.match(
          mockConsole.log.args[0][0],
          /^SKIP: /,
          'Reporter should indicate that a test failed'
        );
      }
    }
  }
});
