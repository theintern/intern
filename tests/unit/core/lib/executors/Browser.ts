import { spy, createSandbox } from 'sinon';
import { Task, isPromiseLike, deepMixin } from 'src/common';
import _Browser, { Config } from 'src/core/lib/executors/Browser';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

let Browser: typeof _Browser;

let removeMocks: () => void;

function createExecutor(config?: Partial<Config>) {
  const executor = new Browser(config);
  executor.registerLoader(
    (_config: { [key: string]: any }) => (_modules: string[]) =>
      Promise.resolve()
  );
  return executor;
}

registerSuite('lib/executors/Browser', function() {
  class MockErrorFormatter {
    format(error: Error) {
      return 'Foo: ' + error.message;
    }
  }

  const sandbox = createSandbox();

  const mockConsole = {
    log: sandbox.spy(() => {}),
    warn: sandbox.spy(() => {}),
    error: sandbox.spy(() => {})
  };

  const mockChai = {
    assert: 'assert',
    should: sandbox.spy(() => 'should')
  };

  const mockGlobal = {
    location: { pathname: '/' },
    __coverage__: {},
    addEventListener: sandbox.spy((..._args: any[]) => {}),
    document: {
      createElement: sandbox.spy((..._args: any[]) => {
        return {
          addEventListener(_name: string, callback: () => void) {
            callback();
          }
        };
      }),
      body: {
        appendChild: sandbox.spy(() => {})
      }
    }
  };

  let executor: _Browser;

  type mockRequest = { json: () => Promise<any> };

  const request = sandbox.spy((_path: string, _data: any) => {
    return Promise.resolve(<mockRequest>{
      json: () => Promise.resolve({})
    });
  });

  class MockMiniMatch {
    set: (string | RegExp)[][];

    constructor(pattern: string) {
      if (/\*/.test(pattern)) {
        this.set = [[/.*/]];
      } else {
        this.set = [[]];
      }
    }
  }

  const mockUtil = {
    getDefaultBasePath() {
      return '';
    }
  };

  return {
    before() {
      return mockRequire(require, 'src/core/lib/executors/Browser', {
        'src/core/lib/common/ErrorFormatter': { default: MockErrorFormatter },
        'src/core/lib/common/console': mockConsole,
        'src/core/lib/browser/util': mockUtil,
        chai: mockChai,
        minimatch: { Minimatch: MockMiniMatch },
        'src/common': {
          request,
          global: mockGlobal,
          isPromiseLike,
          Task,
          deepMixin
        }
      }).then(handle => {
        removeMocks = handle.remove;
        Browser = handle.module.default;
      });
    },

    after() {
      removeMocks();
    },

    beforeEach() {
      executor = createExecutor();
    },

    afterEach() {
      sandbox.reset();
    },

    tests: {
      construct: {
        'listeners added'() {
          assert.equal(mockGlobal.addEventListener.callCount, 2);
          assert.equal(
            mockGlobal.addEventListener.getCall(0).args[0],
            'unhandledRejection'
          );
          assert.equal(mockGlobal.addEventListener.getCall(1).args[0], 'error');
        },

        async 'unhandled rejection'() {
          const logger = spy((..._args: any[]) => {});
          executor.on('error', logger);

          const handler = mockGlobal.addEventListener.getCall(0).args[1];
          const reason = new Error('foo');
          handler({ reason });

          let caughtError: Error | undefined;
          try {
            await executor.run();
          } catch (error) {
            caughtError = error;
          }

          assert.isDefined(caughtError, 'Run should have errored');

          assert.equal(logger.callCount, 1);
          assert.strictEqual(
            logger.getCall(0).args[0],
            reason,
            'expected emitted error to be error passed to listener'
          );
          assert.equal(caughtError!.message, 'An error was emitted');
        },

        async 'unhandled rejection warning'() {
          const warningLogger = spy((..._args: any[]) => {});
          executor.on('warning', warningLogger);
          const errorLogger = spy(() => {});
          executor.on('error', errorLogger);
          executor.configure({ warnOnUnhandledRejection: true });

          const handler = mockGlobal.addEventListener.getCall(0).args[1];
          const reason1 = `${new Error('foo')}`;
          handler({ reason: reason1 });
          const reason2 = `${new Error('bar')}`;
          handler({ reason: reason2 });

          await executor.run();

          assert.equal(warningLogger.callCount, 2);
          assert.strictEqual(
            warningLogger.getCall(0).args[0],
            `${reason1}`,
            'expected emitted error to be error passed to warning listener'
          );
          assert.strictEqual(
            warningLogger.getCall(1).args[0],
            `${reason2}`,
            'expected emitted error to be error passed to warning listener'
          );
        },

        async 'unhandled rejection warning filter'() {
          const warningLogger = spy((..._args: any[]) => {});
          executor.on('warning', warningLogger);
          const errorLogger = spy((..._args: any[]) => {});
          executor.on('error', errorLogger);
          executor.configure({ warnOnUnhandledRejection: 'foo' });

          const handler = mockGlobal.addEventListener.getCall(0).args[1];
          const reason1 = `${new Error('foo')}`;
          handler({ reason: reason1 });
          const reason2 = `${new Error('bar')}`;
          handler({ reason: reason2 });

          let succeeded = false;
          try {
            await executor.run();
            succeeded = true;
          } catch (error) {
            // do nothing
          }

          assert.isFalse(succeeded, 'Run should have errored');

          assert.equal(warningLogger.callCount, 1);
          assert.strictEqual(
            warningLogger.getCall(0).args[0],
            `${reason1}`,
            'expected emitted error to be reason passed to warning listener'
          );

          assert.equal(errorLogger.callCount, 1);
          assert.strictEqual(
            errorLogger.getCall(0).args[0],
            reason2,
            'expected emitted error to be error passed to error listener'
          );
        },

        async 'unhandled error'() {
          const logger = spy((..._args: any[]) => {});
          executor.on('error', logger);

          const handler = mockGlobal.addEventListener.getCall(1).args[1];
          handler({ message: 'foo' });

          let caughtError: Error | undefined;
          try {
            await executor.run();
          } catch (error) {
            caughtError = error;
          }

          assert.isDefined(caughtError, 'Run should have errored');

          assert.equal(logger.callCount, 1);
          assert.propertyVal(
            logger.getCall(0).args[0],
            'message',
            'foo',
            'expected emitted error to be error passed to listener'
          );
          assert.equal(caughtError!.message, 'An error was emitted');
        },

        async 'unhandled error warning'() {
          const warningLogger = spy((..._args: any[]) => {});
          executor.on('warning', warningLogger);
          const errorLogger = spy((..._args: any[]) => {});
          executor.on('error', errorLogger);
          executor.configure({ warnOnUncaughtException: true });

          const handler = mockGlobal.addEventListener.getCall(1).args[1];
          const reason1 = 'foo';
          handler({ message: reason1 });
          const reason2 = 'bar';
          handler({ message: reason2 });

          await executor.run();

          assert.equal(warningLogger.callCount, 2);
          assert.strictEqual(
            warningLogger.getCall(0).args[0],
            `${new Error(reason1)}`,
            'expected emitted error to be error passed to warning listener'
          );
          assert.strictEqual(
            warningLogger.getCall(1).args[0],
            `${new Error(reason2)}`,
            'expected emitted error to be error passed to warning listener'
          );
        },

        async 'unhandled error warning filter'() {
          const warningLogger = spy((..._args: any[]) => {});
          executor.on('warning', warningLogger);
          const errorLogger = spy((..._args: any[]) => {});
          executor.on('error', errorLogger);
          executor.configure({ warnOnUncaughtException: 'foo' });

          const handler = mockGlobal.addEventListener.getCall(1).args[1];
          const reason1 = 'foo';
          handler({ message: reason1 });
          const reason2 = 'bar';
          handler({ message: reason2 });

          let caughtError: Error | undefined;
          try {
            await executor.run();
          } catch (error) {
            caughtError = error;
          }

          assert.isDefined(caughtError, 'Run should have errored');

          assert.equal(warningLogger.callCount, 1, 'Expected 1 warning');
          assert.strictEqual(
            warningLogger.getCall(0).args[0],
            `${new Error(reason1)}`,
            'expected emitted error to be reason passed to warning listener'
          );

          assert.equal(errorLogger.callCount, 1, 'Expected 1 error');
          assert.propertyVal(
            errorLogger.getCall(0).args[0],
            'message',
            'bar',
            'expected emitted error to be error passed to listener'
          );
          assert.equal(caughtError!.message, 'An error was emitted');
        },

        configure() {
          const configured = createExecutor({ suites: ['foo.js'] });
          assert.deepEqual(configured.config.suites, ['foo.js']);
        }
      },

      '#configure': {
        'suite globs'() {
          executor.configure({ suites: ['**/*.js', 'bar.js'] });
          return executor.run().then(() => {
            assert.equal(request.callCount, 1, 'expected a request');
            assert.deepEqual(
              request.args[0],
              [
                '__resolveSuites__',
                { query: { suites: ['**/*.js', 'bar.js'] } }
              ],
              'unexpected args to suite resolution request'
            );
          });
        }
      },

      '#environment'() {
        assert.equal(executor.environment, 'browser');
      },

      '#loadScript': {
        'null input'() {
          // Verify that it doesn't reject
          assert.throws(() => {
            executor.loadScript(<any>null);
          }, /null/);
        },

        'single script'() {
          return executor.loadScript('foo.js').then(() => {
            const createElement = mockGlobal.document.createElement;
            assert.equal(createElement.callCount, 1);
            assert.equal(createElement.getCall(0).args[0], 'script');
          });
        },

        'multiple scripts'() {
          return executor.loadScript(['foo.js', 'bar.js']).then(() => {
            const createElement = mockGlobal.document.createElement;
            assert.equal(createElement.callCount, 2);
            assert.equal(createElement.getCall(0).args[0], 'script');
            assert.equal(createElement.getCall(1).args[0], 'script');
          });
        }
      },

      '#run'() {
        return executor.run();
      }
    }
  };
});
