import { Executor } from 'src/core/lib/executors/Executor';
import _Test, {
  isTest,
  isTestFunction,
  isTestOptions,
  TestOptions,
  TestProperties
} from 'src/core/lib/Test';
import Suite from 'src/core/lib/Suite';
import { isCancel } from 'src/common';

import {
  createMockRemote,
  createMockExecutor,
  createMockSession
} from 'tests/support/unit/mocks';
import { mockImport } from 'tests/support/mockUtil';
import { createSuite } from 'tests/support/unit/factories';

let Test: typeof _Test;

function createTest(
  options: Partial<TestProperties> & { executor?: Executor } = {}
) {
  if (!options.parent) {
    options.parent = <Suite>{};
  }
  if (!options.test) {
    options.test = () => {};
  }
  if (!options.parent.executor) {
    const executor = options.executor || createMockExecutor();
    delete options.executor;
    options.parent.executor = executor;
  }
  return new Test(<TestOptions>options);
}

registerSuite('core/lib/Test', {
  async before() {
    Test = (await mockImport(() => import('src/core/lib/Test'))).default;
  },

  tests: {
    '#constructor'() {
      assert.throws(() => {
        new Test(<any>{});
      }, /requires a name/);
      assert.throws(() => {
        new Test(<any>{ name: 'foo' });
      }, /requires a name/);
      assert.throws(() => {
        new Test(<any>{ test: () => {} });
      }, /requires a name/);
    },

    '#test'() {
      const dfd = this.async(250);
      let executed = false;

      const test = createTest({
        name: 'test test',
        test() {
          executed = true;
        }
      });

      test.run().then(
        dfd.callback(function() {
          assert.isTrue(
            executed,
            'Test function should be called when run is called'
          );
        })
      );
    },

    '#test throws'() {
      const dfd = this.async(250);
      const thrownError = new Error('Oops');
      const test = createTest({
        name: 'throws test',
        test() {
          throw thrownError;
        }
      });

      test.run().then(
        () => {
          dfd.reject(
            new Error('Test should not resolve when it throws an error')
          );
        },
        dfd.callback((error: Error) => {
          assert.strictEqual<Error | undefined>(
            test.error,
            thrownError,
            'Error thrown by test should be the error set on test'
          );
          assert.strictEqual(
            error,
            thrownError,
            'Error thrown by test should be the error used by the promise'
          );
        })
      );
    },

    '#async': {
      implicit() {
        let resolved = false;
        const test = createTest({
          name: 'async implicit test',
          test() {
            const dfd = this.async();
            setTimeout(function() {
              resolved = true;
              dfd.resolve();
            }, 0);
          }
        });

        const promise = test.run().then(
          () =>
            assert.isTrue(
              resolved,
              'Test promise should have been resolved by the asynchronous code in the test'
            ),
          () => {
            throw new Error(
              'Test promise should resolve successfully, without any timeout'
            );
          }
        );

        assert.isFalse(
          resolved,
          'Test promise should not resolve immediately after calling run'
        );
        return promise;
      },

      explicit() {
        let resolved = false;
        const test = createTest({
          name: 'async explicit test',
          test() {
            return new Promise(resolve => {
              setTimeout(function() {
                resolved = true;
                resolve();
              }, 0);
            });
          }
        });

        const promise = test.run().then(
          () =>
            assert.isTrue(
              resolved,
              'Test promise should have been resolved by the asynchronous code in the test'
            ),
          () => {
            throw new Error(
              'Test promise should resolve successfully, without any timeout'
            );
          }
        );

        assert.isFalse(
          resolved,
          'Test promise should not resolve immediately after calling run'
        );
        return promise;
      },

      'callback + numCallsUntilResolution'() {
        const dfd = this.async();
        let numCalls = 0;
        const test = createTest({
          name: 'callback numCalls test',
          test() {
            const dfd = this.async(250, 3);

            for (let i = 0; i < 3; ++i) {
              dfd.callback(function() {
                ++numCalls;
              })();
            }
          }
        });

        test.run().then(
          () => {
            assert.strictEqual(
              numCalls,
              3,
              'Callback method should have been invoked three times before test completed'
            );
            dfd.resolve();
          },
          () => {
            dfd.reject(
              new Error(
                'Test should pass if specified number of callbacks are triggered on the promise'
              )
            );
          }
        );
      },

      '-> timeout'() {
        const dfd = this.async(500);
        const test = createTest({
          name: 'timeout test',
          test() {
            this.async(100);
          }
        });

        test.run().then(
          () => {
            dfd.reject(
              new Error(
                'Test should timeout if async and the promise is never resolved'
              )
            );
          },
          error => {
            assert.ok(error, 'Timeout error thrown in async test');
            dfd.resolve();
          }
        );
      },

      '-> reject'() {
        const thrownError = new Error('Oops');

        const test = createTest({
          name: 'reject test',
          test() {
            const d = this.async();
            d.reject(thrownError);
          }
        });

        return test.run().then(
          () => {
            throw new Error(
              'Test should throw if async and the promise is rejected'
            );
          },
          error => {
            assert.strictEqual<Error | undefined>(
              test.error,
              error,
              'Error thrown in test should equal our assertion error'
            );
            assert.strictEqual(
              error,
              thrownError,
              'Error thrown in test should be the error used by the promise'
            );
          }
        );
      },

      'excessive resolution'() {
        const test = createTest({
          name: 'excessive resolution test',
          test() {
            const d = this.async();
            d.resolve();
            d.resolve();
          }
        });

        return test.run().then(
          () => {
            throw new Error('Test should have thrown');
          },
          error => assert.match(error.message, /called too many times/)
        );
      }
    },

    '#timeElapsed'() {
      const test = createTest({
        name: 'timeElapsed test',
        test() {
          const dfd = this.async();
          setTimeout(function() {
            dfd.resolve();
          }, 100);
        }
      });

      return test.run().then(() => {
        // It isn't really our job to test how accurate browsers are, and
        // this test will randomly fail when a browser decides to be slow
        // for no reason (or execute setTimeout too fast for no reason) so
        // we need to be really lax with this check
        assert.typeOf(
          test.timeElapsed,
          'number',
          'Test time elapsed should be a number'
        );
        assert(
          test.timeElapsed! > 0,
          'Test time elapsed for 100ms async test should be greater than zero milliseconds'
        );
      });
    },

    '#toJSON'() {
      const test = createTest({
        name: 'test name',
        parent: <Suite>{
          id: 'parent id',
          name: 'parent id',
          sessionId: 'abcd',
          timeout: 30000
        },
        test() {}
      });
      const expected: { [key: string]: any } = {
        id: 'parent id - test name',
        parentId: 'parent id',
        name: 'test name',
        sessionId: 'abcd',
        timeElapsed: 100,
        timeout: 30000,
        hasPassed: true
      };

      return test.run().then(() => {
        // Elapsed time is non-deterministic, so just force it to a value we
        // can test
        test['_timeElapsed'] = 100;

        assert.deepEqual(
          test.toJSON(),
          expected,
          '#toJSON should return expected JSON structure for test with no error'
        );

        test.error = expected.error = {
          name: 'Oops',
          message: 'message',
          stack: 'stack',
          showDiff: false
        };

        test.suiteError = expected.suiteError = {
          name: 'Suite error',
          message: 'message',
          stack: 'stack',
          lifecycleMethod: 'afterEach' as const,
          showDiff: false
        };

        assert.deepEqual(
          test.toJSON(),
          expected,
          '#toJSON should return expected JSON structure for test with error not including diff info'
        );

        test.error = expected.error = {
          name: 'Oops',
          message: 'message',
          stack: 'stack',
          showDiff: true,
          expected: 'foo',
          actual: 'bar'
        };
        assert.deepEqual(
          test.toJSON(),
          expected,
          '#toJSON should return expected JSON structure for test with error including diff info'
        );
      });
    },

    '#hasPassed'() {
      const dfd = this.async(undefined, 2);
      const thrownError = new Error('Oops');
      const goodTest = createTest({ name: 'good', test() {} });
      const badTest = createTest({
        name: 'bad',
        test() {
          throw thrownError;
        }
      });

      assert.isFalse(
        goodTest.hasPassed,
        'Good test should not have passed if it has not been executed'
      );
      assert.isFalse(
        badTest.hasPassed,
        'Bad test should not have passed if it has not been executed'
      );
      goodTest.run().finally(
        dfd.callback(function() {
          assert.isTrue(
            goodTest.hasPassed,
            'Good test should have passed after execution without error'
          );
        })
      );
      badTest
        .run()
        .catch(() => {})
        .finally(
          dfd.callback(function() {
            assert.isFalse(
              badTest.hasPassed,
              'Bad test should not have passed after execution with error'
            );
            assert.strictEqual<Error | undefined>(
              badTest.error,
              thrownError,
              'Bad test error should be the error which was thrown'
            );
          })
        );
    },

    '#sessionId'() {
      const test = createTest({
        name: 'sessionId test',
        parent: createSuite({ name: 'bar', sessionId: 'parent' })
      });
      assert.strictEqual(
        test.sessionId,
        test.parent.sessionId,
        "#sessionId should get the sessionId from the test's parent"
      );
    },

    '#remote'() {
      const remote = createMockRemote({
        session: createMockSession({ sessionId: 'test' })
      });
      const test = createTest({
        name: 'remote test',
        parent: createSuite({ name: 'bar', remote })
      });
      assert.strictEqual(
        test.remote,
        remote,
        "#remote should get the remote value from from the test's parent"
      );
    },

    '#skip'() {
      let actual: _Test;
      const expected = createTest({
        name: 'skip test',
        test() {
          this.skip('IT’S A TRAP');
        },
        executor: createMockExecutor({
          emit(event: string, data?: any) {
            if (event === 'testEnd' && data.skipped) {
              actual = data;
            }
            return Promise.resolve();
          }
        })
      });

      return expected.run().then(function() {
        assert.strictEqual(
          actual,
          expected,
          'testSkip topic should fire when a test is skipped'
        );
        assert.strictEqual(
          actual.skipped,
          'IT’S A TRAP',
          'test should have `skipped` property with expected value'
        );
      });
    },

    'using remote in a test': {
      'fails if test is synchronous'() {
        // Increase timeout for IE11
        this.timeout = 5000;
        const test = createTest({
          name: 'files if sync test',
          test() {
            this.remote;
          }
        });

        return test.run().then(
          () => {
            assert.fail('test should not have passed');
          },
          error => {
            assert.match(
              error.message,
              /^Remote used in synchronous test/,
              'unexpected error message'
            );
          }
        );
      },

      'works if test returns a promise'() {
        // Increase timeout for IE11
        this.timeout = 5000;
        const test = createTest({
          name: 'works if promise test',
          test() {
            this.remote;
            return Promise.resolve();
          }
        });

        return test.run();
      },

      'works if test resolves async dfd'() {
        // Increase timeout for IE11
        this.timeout = 5000;
        const test = createTest({
          name: 'works if dfd test',
          test: function() {
            const dfd = this.async();
            this.remote;
            dfd.resolve();
          }
        });

        return test.run();
      }
    },

    '#restartTimeout'() {
      const test = createTest({
        name: 'restartTimeout test',
        test() {
          // Set a short timeout -- test will fail if restartTimeout isn't called
          this.timeout = 400;
          return new Promise(resolve => {
            setTimeout(resolve, 800);
          });
        }
      });

      const run = test.run();
      // Call restartTimeout in a setTimeout so it isn't called until the test has
      // actually started
      setTimeout(() => test.restartTimeout(1000));
      return run.catch(function() {
        assert(false, 'Test should not timeout before it is resolved');
      });
    },

    'Test timeout using Promise with no cancel'() {
      const test = createTest({
        name: 'promise no cancel test',
        test() {
          this.timeout = 1;
          return new Promise(() => {});
        }
      });

      return test.run().then(
        function() {
          assert(false, 'Test should timeout');
        },
        function(error: Error) {
          assert.include(
            error.message,
            'Timeout reached',
            'Timeout should occur when using a Promise with no cancel'
          );
        }
      );
    },

    'support functions': {
      isTest() {
        assert.isFalse(isTest(null));
        assert.isFalse(isTest({}));
        assert.isTrue(isTest(createTest({ name: 'foo' })));
        assert.isTrue(isTest({ test() {}, hasPassed: false }));
      },

      isTestOptions() {
        assert.isFalse(isTestOptions(null));
        assert.isFalse(isTestOptions({}));
        assert.isFalse(isTestOptions(createTest({ name: 'foo' })));
        assert.isTrue(isTestOptions({ test() {}, name: 'foo' }));
      },

      isTestFunction() {
        assert.isFalse(isTestFunction(null));
        assert.isFalse(isTestFunction({}));
        assert.isTrue(isTestFunction(() => {}));
      }
    },

    cancel() {
      const test = createTest({
        name: 'cancel test',
        test() {
          return new Promise(() => {});
        }
      });

      const runPromise = test.run();

      setTimeout(() => {
        test.cancel();
      });

      return runPromise.then(
        () => {
          throw new Error('Test promise should not have resolved');
        },
        error => {
          assert.isTrue(isCancel(error), 'Test run should have been cancelled');
        }
      );
    }
  }
});
