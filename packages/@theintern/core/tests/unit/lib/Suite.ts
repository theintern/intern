import Suite, { SuiteOptions } from 'src/lib/Suite';
import Test from 'src/lib/Test';
import { InternError } from 'src/lib/types';
import { isCancel } from '@theintern/common';

import {
  createMockExecutor,
  createMockRemoteAndSession,
  createMockRemote,
} from 'tests/support/unit/mocks';
import _Deferred from 'src/lib/Deferred';
import { TestFunction as _TestFunction } from 'src/lib/Test';
import {
  ObjectSuiteDescriptor as _ObjectSuiteDescriptor,
  Tests,
} from 'src/lib/interfaces/object';
import {
  SuiteLifecycleFunction,
  TestLifecycleFunction,
  isFailedSuite,
} from 'src/lib/Suite';
import sinon from 'sinon';

type lifecycleMethod = 'before' | 'beforeEach' | 'afterEach' | 'after';

interface TestWrapper {
  (func: (done: () => void) => _TestFunction): _TestFunction;
}

function createAsyncAndPromiseTest(testWrapper: TestWrapper) {
  return testWrapper(function (done: () => void) {
    return function () {
      this.async();
      return new Promise((resolve) => {
        setTimeout(function () {
          done();
          resolve();
        }, 20);
      });
    };
  });
}

function createAsyncCallbackTest(testWrapper: TestWrapper) {
  return testWrapper(function (done: () => void) {
    return function () {
      const setupDfd = this.async();
      setTimeout(function () {
        done();
        setupDfd.callback(<any>function () {})();
      }, 20);
    };
  });
}

type TestSuiteOptions = Partial<Suite> & { tests?: (Suite | Test)[] };
function createSuite(options?: TestSuiteOptions) {
  options = options || {};
  if (!options.executor && !(options.parent && options.parent.executor)) {
    options.executor = createMockExecutor();
  }
  return new Suite(<SuiteOptions>options);
}

function createSuiteWithTest() {
  return createSuite({
    tests: [
      new Test({
        name: 'foo',
        test() {},
      }),
    ],
  });
}

function createAsyncRejectOnErrorTest(method: lifecycleMethod): _TestFunction {
  return function () {
    const dfd = this.async(1000);
    const suite = createSuite();
    const test = new Test({ name: 'foo', test() {}, parent: suite });

    suite.tests.push(test);

    suite[method] = function (this: Suite | Test) {
      const dfd = this.async!(20);
      dfd.rejectOnError(function () {})();
    };

    suite.run().then(
      <any>function () {
        dfd.reject(new Error('Suite should not have resolved'));
      },
      dfd.callback(<any>function () {
        assert.match(
          suite.error!.message,
          new RegExp('Timeout reached .*' + method + '$'),
          'Error should have been a timeout error for ' + method
        );
      })
    );
  };
}

function createAsyncTest(testWrapper: TestWrapper) {
  return testWrapper(function (done: () => void) {
    return function () {
      const setupDfd = this.async();
      setTimeout(function () {
        done();
        setupDfd.resolve();
      }, 20);
    };
  });
}

function createLifecycle(options: any = {}): _TestFunction {
  let expectedLifecycle: (string | number)[];

  if (!options.name) {
    options.name = 'foo';
  }

  if (options.publishAfterSetup) {
    expectedLifecycle = [
      'before',
      'startTopic',
      'beforeEach',
      0,
      'afterEach',
      'beforeEach',
      1,
      'afterEach',
      'endTopic',
      'after',
      'done',
    ];
  } else {
    expectedLifecycle = [
      'startTopic',
      'before',
      'beforeEach',
      0,
      'afterEach',
      'beforeEach',
      1,
      'afterEach',
      'after',
      'endTopic',
      'done',
    ];
  }

  return function () {
    const dfd = this.async(5000);

    options.executor = createMockExecutor({
      emit(event: string, data?: any) {
        try {
          if (event === 'suiteStart') {
            results.push('startTopic');
            assert.deepEqual(
              data,
              suite,
              'Arguments broadcast to /suite/start should be the suite being executed'
            );

            if (options.publishAfterSetup) {
              assert.deepEqual(
                results,
                ['before', 'startTopic'],
                'Suite start topic should broadcast after suite starts'
              );
            } else {
              assert.deepEqual(
                results,
                ['startTopic'],
                'Suite start topic should broadcast before suite starts'
              );
            }
          } else if (event === 'suiteEnd') {
            results.push('endTopic');
            assert.deepEqual(
              data,
              suite,
              'Arguments broadcast to suiteEnd should be the suite being executed'
            );
          }
        } catch (error) {
          dfd.reject(error);
        }

        return Promise.resolve();
      },
    });

    const suite = new Suite(options);
    const results: (string | number)[] = [];

    ['before', 'beforeEach', 'afterEach', 'after'].forEach((methodName) => {
      const method = <lifecycleMethod>methodName;
      suite[method] = function () {
        results.push(method);
        return Promise.resolve();
      };
    });

    [0, 1].forEach(function (i) {
      suite.tests.push(
        new Test({
          name: `bar${i}`,
          test() {
            results.push(i);
          },
          parent: suite,
        })
      );
    });

    suite.run().then(
      dfd.callback(function () {
        results.push('done');
        assert.deepEqual(
          results,
          expectedLifecycle,
          'Suite methods should execute in the correct order'
        );
      })
    );
  };
}

function createPromiseTest(testWrapper: TestWrapper) {
  return testWrapper(function (done: () => void) {
    return function () {
      return new Promise((resolve) => {
        setTimeout(function () {
          done();
          resolve();
        }, 20);
      });
    };
  });
}

function createThrowsTest(
  method: lifecycleMethod,
  options: any = {}
): _TestFunction {
  return function () {
    const dfd = this.async(1000);
    const suite = createSuite();
    const test = new Test({ name: 'foo', test() {}, parent: suite });
    const thrownError = new Error('Oops');
    let finished = false;

    (<any>suite)[method] = function (this: Test) {
      if (options.promise || options.async) {
        const dfd = options.async ? this.async() : new _Deferred();

        setTimeout(function () {
          dfd.reject(thrownError);
        }, 20);

        if (options.promise) {
          return dfd.promise;
        }
      } else {
        throw thrownError;
      }
    };

    suite.tests.push(test);

    suite.run().then(
      () => {
        finished = true;
        dfd.reject(
          new Error(
            `Suite should never resolve after a fatal error in ${method}`
          )
        );
      },
      dfd.callback((error: InternError) => {
        finished = true;
        assert.strictEqual<Error | undefined>(
          suite.error,
          thrownError,
          `Error thrown in ${method} should be the error set on suite`
        );
        assert.strictEqual(
          error,
          thrownError,
          `Error thrown in  ${method} should be the error used by the promise`
        );

        if (method === 'beforeEach' || method === 'afterEach') {
          assert.strictEqual(
            error.relatedTest,
            test,
            `Error thrown in ${method} should have the related test in the error`
          );
        }
      })
    );

    assert.isFalse(finished, 'Suite should not finish immediately after run()');
  };
}

function createTimeoutTest(
  method: lifecycleMethod,
  additionalSetup?: () => void
): _TestFunction {
  return function () {
    additionalSetup && additionalSetup();

    const dfd = this.async(1000);
    const suite = createSuite();
    const test = new Test({ name: 'foo', test() {}, parent: suite });
    let finished = false;

    (<any>suite)[method] = function (this: Test) {
      const dfd = this.async(10);
      setTimeout(function () {
        dfd.resolve();
      }, 20);
    };

    suite.tests.push(test);

    suite.run().then(
      function () {
        finished = true;
        dfd.reject(
          new Error(
            'Suite should never resolve after a fatal error in ' + method
          )
        );
      },
      dfd.callback(function () {
        finished = true;
        assert.match(
          suite.error!.message,
          new RegExp('Timeout reached .*' + method + '$'),
          'Error should have been a timeout error for ' + method
        );
        if (method === 'beforeEach' || method === 'afterEach') {
          assert.strictEqual(
            suite.error!.relatedTest,
            test,
            'Error thrown in ' +
              method +
              ' should have the related test in the error'
          );
        }
      })
    );

    assert.isFalse(finished, 'Suite should not finish immediately after run()');
  };
}

/**
 * Verify that lifecycle methods are called with the expected arguments
 */
function createArgsTest(method: lifecycleMethod): _TestFunction {
  return function () {
    const suite = createSuite({
      [method]: (...args: any[]) => {
        if (/Each$/.test(method)) {
          assert.instanceOf(args[0], Test);
          assert.instanceOf(args[1], Suite);
        } else {
          assert.instanceOf(args[0], Suite);
        }
      },
      tests: [new Test({ name: 'foo', test: () => {} })],
    });

    return suite.run();
  };
}

function createLifecycleTests(
  name: lifecycleMethod,
  asyncTest: TestWrapper,
  tests: { [name: string]: _TestFunction }
) {
  return {
    tests: <{ [key: string]: _TestFunction }>{
      promise: createPromiseTest(asyncTest),
      async: createAsyncTest(asyncTest),
      'async with promise': createAsyncAndPromiseTest(asyncTest),
      throws: createThrowsTest(name),
      'async callback': createAsyncCallbackTest(asyncTest),
      'async rejectOnError': createAsyncRejectOnErrorTest(name),
      'async rejects': createThrowsTest(name, { async: true }),
      'async timeout': createTimeoutTest(name),
      'async timeout is unaffected by stubbed timers': createTimeoutTest(
        name,
        () => sandbox.useFakeTimers()
      ),
      'promise rejects': createThrowsTest(name, { promise: true }),
      arguments: createArgsTest(name),
      ...tests,
    },
  };
}

function createGrepLifecycleTests() {
  function generate(method: lifecycleMethod): _TestFunction {
    return function () {
      const dfd = this.async(5000);
      const testsRun: Test[] = [];

      const suitesWithLifecycleExecuted: Suite[] = [];

      const expectedTestsExecuted: Test[] = [];
      const expectedSuitesWithLifecycleExecuted: Suite[] = [];

      function createTrackedTest(name: string, testShouldRun: boolean) {
        const test = new Test({
          name,
          test() {
            testsRun.push(this);
          },
        });

        if (testShouldRun) {
          expectedTestsExecuted.push(test);
        }

        return test;
      }

      function createLifecycleTrackedSuite(
        options: TestSuiteOptions,
        lifeCycleMethodShouldRun: boolean
      ) {
        const suite = createSuite({
          ...options,
          [method]() {
            if (!suitesWithLifecycleExecuted.some((x) => x === this)) {
              suitesWithLifecycleExecuted.push(this as Suite);
            }
          },
        });

        const parent = options.parent;
        if (parent) {
          parent.add(suite);
        }

        if (lifeCycleMethodShouldRun) {
          expectedSuitesWithLifecycleExecuted.push(suite);
        }

        return suite;
      }

      const rootSuite = createLifecycleTrackedSuite(
        {
          name: 'root',
          grep: /foo/,
          executor: createMockExecutor(),
        },
        true
      );

      const foobarTest = createTrackedTest('foobar', true);
      const firstLevelSuite = createLifecycleTrackedSuite(
        {
          name: 'first level',
          tests: [foobarTest],
          parent: rootSuite,
        },
        true
      );

      // Set up some tests and suites with nesting
      const fooTest = createTrackedTest('matching test foo', true);
      const foodTest = createTrackedTest('matching tests food', true);
      createLifecycleTrackedSuite(
        {
          name: 'tests matching grep',
          tests: [fooTest, foodTest],
          parent: firstLevelSuite,
        },
        true
      );

      const nonMatchingTest = createTrackedTest('no match', false);
      createLifecycleTrackedSuite(
        {
          name: 'suite with no grep matches',
          tests: [nonMatchingTest],
          parent: rootSuite,
        },
        false
      );

      const testMatchingSuite1 = createTrackedTest(
        'test within matching suite',
        true
      );
      const testMatchingSuite2 = createTrackedTest(
        'second test within matching suite',
        true
      );

      createLifecycleTrackedSuite(
        {
          name: 'suite matching foo',
          tests: [testMatchingSuite1, testMatchingSuite2],
          parent: firstLevelSuite,
        },
        true
      );

      createLifecycleTrackedSuite(
        { name: 'foo with no tests', tests: [], parent: firstLevelSuite },
        false
      );

      rootSuite.run().then(
        dfd.callback(function () {
          assert.sameMembers(
            testsRun,
            expectedTestsExecuted,
            'Only tests with a matching grep regex should have run'
          );

          assert.sameMembers(
            suitesWithLifecycleExecuted,
            expectedSuitesWithLifecycleExecuted,
            'Only life cycle functions within suites containing tests which match grep regex should have run'
          );
        }),
        function () {
          dfd.reject(new Error('Suite should not fail'));
        }
      );
    };
  }

  const result = <{ [name: string]: _TestFunction }>{};

  const lifeCycleMethods: lifecycleMethod[] = [
    'before',
    'beforeEach',
    'after',
    'afterEach',
  ];

  lifeCycleMethods.forEach((m) => {
    result[`${m} is not executed when all children are skipped`] = generate(m);
  });

  return result;
}

let sandbox: sinon.SinonSandbox;
registerSuite('lib/Suite', {
  beforeEach() {
    sandbox = sinon.createSandbox();
  },

  afterEach() {
    sandbox.restore();
  },

  tests: {
    '#constructor required parameters'() {
      assert.throws(() => {
        new Suite(<any>{ parent: {} });
      }, /must have a name/);
    },

    properties: {
      '#name'() {
        const suite = createSuite({
          name: 'foo',
          parent: createSuite({ name: 'parent' }),
        });
        assert.strictEqual(
          suite.name,
          'foo',
          '#name should return correct suite name'
        );
      },

      '#id'() {
        const suite = createSuite({
          name: 'foo',
          parent: createSuite({ name: 'parent' }),
        });
        assert.strictEqual(
          suite.id,
          'parent - foo',
          '#id should return correct suite id'
        );
      },

      '#parentId'() {
        const suite = createSuite({
          name: 'foo',
          parent: createSuite({ name: 'parent' }),
        });
        assert.strictEqual(
          suite.parentId,
          'parent',
          '#parentId should return correct parent id'
        );
      },

      '#timeout'() {
        const suite = createSuite({ name: 'suite' });
        assert.strictEqual(
          suite.timeout,
          30000,
          'expected suite#timeout to have default value'
        );

        const parent = createSuite({ name: 'parent', timeout: 50 });
        const child = createSuite({ name: 'foo', parent });
        assert.strictEqual(
          parent.timeout,
          50,
          'expected parent#timeout to have given value'
        );
        assert.strictEqual(
          child.timeout,
          50,
          'expected suite#timeout to have same value as parent'
        );
      },

      '#executor set multiple times'() {
        const suite = createSuite({ name: 'foo' });
        assert.throws(() => {
          suite.executor = <any>{};
        }, /executor may only be set/);
      },

      '#remote'() {
        const parentRemote = createMockRemoteAndSession('remote');
        const parentSuite = createSuite({
          name: 'bar',
          remote: parentRemote,
        });
        const mockRemote = createMockRemoteAndSession('local');
        const suite = createSuite({ name: 'foo', remote: mockRemote });
        let thrown = false;

        assert.strictEqual(
          suite.remote,
          mockRemote,
          '#remote should come from suite when set'
        );

        suite.parent = parentSuite;

        assert.strictEqual(
          suite.remote,
          parentRemote,
          '#remote from parent should override local value'
        );

        try {
          suite.remote = <any>mockRemote;
        } catch (e) {
          thrown = true;
        }

        assert.isTrue(
          thrown,
          'An error should be thrown when #remote is set more than once'
        );
      },

      '#sessionId'() {
        const suite = createSuite({ name: 'foo' });
        assert.strictEqual(
          suite.sessionId,
          '',
          '#sessionId should be empty by default'
        );

        suite.remote = createMockRemoteAndSession('remote');
        assert.strictEqual(
          suite.sessionId,
          'remote',
          '#sessionId should come from remote if one exists'
        );

        suite.sessionId = 'local';
        assert.strictEqual(
          suite.sessionId,
          'local',
          '#sessionId from the suite itself should override remote'
        );

        suite.parent = createSuite({ name: 'foo', sessionId: 'parent' });
        assert.strictEqual(
          suite.sessionId,
          'parent',
          "#sessionId from the parent should override the suite's"
        );
      },

      'test counts': (() => {
        function runTest(type: keyof Suite, expectedCount: number) {
          const suite = createSuite({
            name: 'foo',
            tests: [
              createSuite({
                name: 'far',
                tests: [
                  new Test({
                    name: 'bar',
                    test() {},
                  }),
                  new Test({
                    name: 'baz',
                    test() {},
                    hasPassed: true,
                  }),
                ],
              }),
              new Test({
                name: 'bif',
                test() {},
                hasPassed: true,
              }),
              new Test({
                name: 'bof',
                test() {},
                hasPassed: true,
              }),
            ],
          });

          (<Suite>suite.tests[0]).tests[0].error = new Error('bad');

          assert.strictEqual(
            suite[type],
            expectedCount,
            `unexpected count for ${type}`
          );
        }

        return {
          '#numTests'() {
            runTest('numTests', 4);
          },

          '#numPassedTests'() {
            runTest('numPassedTests', 3);
          },

          '#numFailedTests'() {
            runTest('numFailedTests', 1);
          },

          '#numSkippedTests'() {
            runTest('numSkippedTests', 0);
          },
        };
      })(),
    },

    '#add': {
      invalid() {
        const suite = createSuite({ name: 'foo' });
        assert.throws(() => {
          suite.add(<any>'foo');
        }, /Tried to add invalid/);
      },

      suite() {
        let topicFired = false;
        let actualSuite: Suite | undefined;
        const suite = createSuite({
          name: 'foo',
          executor: createMockExecutor({
            emit(event: string, suite?: Suite) {
              if (event === 'suiteAdd') {
                topicFired = true;
                actualSuite = suite;
              }
              return Promise.resolve();
            },
          }),
        });

        const parent = createSuite({ name: 'parent' });
        suite.add(parent);
        assert.isTrue(
          topicFired,
          'suiteAdd should be reported after a suite is added'
        );
        assert.strictEqual(
          actualSuite,
          parent,
          'suiteAdd should be passed the suite that was just added'
        );

        const child = createSuite({ name: 'child', parent });
        assert.throws(() => {
          suite.add(child);
        }, /already belongs/);
      },

      test() {
        let topicFired = false;
        let actualTest: Test | undefined;
        const suite = createSuite({
          name: 'foo',
          executor: createMockExecutor({
            emit(event: string, test?: Test) {
              if (event === 'testAdd') {
                topicFired = true;
                actualTest = test;
              }
              return Promise.resolve();
            },
          }),
        });

        const test = new Test({ name: 'child', test() {} });
        suite.add(test);
        assert.isTrue(
          topicFired,
          'testAdd should be reported after a suite is added'
        );
        assert.strictEqual(
          actualTest,
          test,
          'testAdd should be passed the suite that was just added'
        );
      },
    },

    lifecycle: createLifecycle(),

    'lifecycle + publishAfterSetup': createLifecycle({
      publishAfterSetup: true,
    }),

    '#before': (function (): _ObjectSuiteDescriptor {
      function asyncTest(
        createSetup: (done: () => void) => _TestFunction
      ): _TestFunction {
        return function () {
          const dfd = this.async();
          const suite = createSuiteWithTest();
          let waited = false;

          suite.before = (createSetup(function () {
            waited = true;
          }) as unknown) as SuiteLifecycleFunction;

          suite.run().then(
            dfd.callback(function () {
              assert.isTrue(
                waited,
                'Asynchronous before should be called before suite finishes'
              );
            })
          );
        };
      }

      return createLifecycleTests('before', asyncTest, {
        synchronous() {
          const dfd = this.async(1000);
          const suite = createSuiteWithTest();
          let called = false;

          suite.before = function () {
            called = true;
          };

          suite.run().then(
            dfd.callback(function () {
              assert.isTrue(
                called,
                'Before should be called before suite finishes'
              );
            })
          );
        },
      });
    })(),

    '#beforeEach': (function (): _ObjectSuiteDescriptor {
      function asyncTest(
        createBeforeEach: (done: () => void) => _TestFunction
      ): _TestFunction {
        return function () {
          const dfd = this.async();
          const suite = createSuite();
          const results: string[] = [];
          let counter = 0;

          function updateCount() {
            results.push('' + counter);
          }

          for (let i = 0; i < 2; ++i) {
            suite.tests.push(
              new Test({
                name: 'foo',
                test: updateCount,
                parent: suite,
              })
            );
          }

          suite.beforeEach = (createBeforeEach(function () {
            results.push('b' + ++counter);
          }) as unknown) as TestLifecycleFunction;

          suite.run().then(
            dfd.callback(function () {
              assert.deepEqual(
                results,
                ['b1', '1', 'b2', '2'],
                'beforeEach should execute before each test'
              );
            })
          );
        };
      }

      const tests = createLifecycleTests('beforeEach', asyncTest, {
        synchronous: function () {
          const dfd = this.async(1000);
          const suite = createSuite();
          const results: string[] = [];
          let counter = 0;

          function updateCount() {
            results.push('' + counter);
          }

          for (let i = 0; i < 2; ++i) {
            suite.tests.push(
              new Test({
                name: 'foo',
                test: updateCount,
                parent: suite,
              })
            );
          }

          suite.beforeEach = function () {
            results.push('b' + ++counter);
          };

          suite.run().then(
            dfd.callback(function () {
              assert.deepEqual(
                results,
                ['b1', '1', 'b2', '2'],
                'beforeEach should execute before each test'
              );
            })
          );

          assert.strictEqual(
            counter,
            0,
            '#beforeEach should not be called immediately after run()'
          );
        },
      });

      tests.tests['skip in beforeEach'] = (test) => {
        const dfd = test.async();
        const suite = createSuite();
        const testToSkip = new Test({
          name: 'foo',
          test: () => {
            tested = true;
          },
          parent: suite,
        });
        let tested = false;
        suite.tests.push(testToSkip);

        suite.beforeEach = (test) => {
          test.skip('skipper');
        };

        suite.run().then(
          dfd.callback(function () {
            assert.isFalse(tested);
            assert.equal(testToSkip.skipped, 'skipper');

            // Verify that a testEnd was emitted for the skipped test
            const events: {
              name: string;
              data: any;
            }[] = (<any>suite.executor).events;
            assert.isTrue(
              events.some(
                ({ name, data }) => name === 'testEnd' && data === testToSkip
              ),
              'expected testEnd event to have been emitted'
            );
          }),
          (error) => {
            dfd.reject(error);
          }
        );
      };

      return tests;
    })(),

    '#afterEach': (function (): _ObjectSuiteDescriptor {
      function asyncTest(
        createAfterEach: (done: () => void) => _TestFunction
      ): _TestFunction {
        return function () {
          const dfd = this.async();
          const suite = createSuite();
          const results: string[] = [];
          let counter = 0;

          function updateCount() {
            results.push('' + ++counter);
          }

          for (let i = 0; i < 2; ++i) {
            suite.tests.push(
              new Test({
                name: 'foo',
                test: updateCount,
                parent: suite,
              })
            );
          }

          suite.afterEach = (createAfterEach(function () {
            results.push('a' + counter);
          }) as unknown) as TestLifecycleFunction;

          suite.run().then(
            dfd.callback(function () {
              assert.deepEqual(
                results,
                ['1', 'a1', '2', 'a2'],
                'afterEach should execute after each test'
              );
            })
          );
        };
      }

      return createLifecycleTests('afterEach', asyncTest, {
        synchronous() {
          const dfd = this.async(1000);
          const suite = createSuite();
          const results: string[] = [];
          let counter = 0;

          function updateCount() {
            results.push('' + ++counter);
          }

          for (let i = 0; i < 2; ++i) {
            suite.tests.push(
              new Test({
                name: 'foo',
                test: updateCount,
                parent: suite,
              })
            );
          }

          suite.afterEach = function () {
            results.push('a' + counter);
          };

          suite.run().then(
            dfd.callback(function () {
              assert.deepEqual(
                results,
                ['1', 'a1', '2', 'a2'],
                'afterEach should execute after each test'
              );
            })
          );

          assert.strictEqual(
            counter,
            0,
            '#afterEach should not be called immediately after run()'
          );
        },
      });
    })(),

    '#after': (function (): _ObjectSuiteDescriptor {
      function asyncTest(
        createAfter: (done: () => void) => _TestFunction
      ): _TestFunction {
        return function () {
          const dfd = this.async();
          const suite = createSuiteWithTest();
          let waited = false;

          suite.after = (createAfter(function () {
            waited = true;
          }) as unknown) as SuiteLifecycleFunction;

          suite.run().then(
            dfd.callback(function () {
              assert.isTrue(
                waited,
                'Asynchronous after should be called before suite finishes'
              );
            })
          );
        };
      }

      return createLifecycleTests('after', asyncTest, {
        synchronous() {
          const dfd = this.async(1000);
          const suite = createSuiteWithTest();
          let called = false;

          suite.after = function () {
            called = true;
          };

          suite.run().then(
            dfd.callback(function () {
              assert.isTrue(
                called,
                'Synchronous after should be called before suite finishes'
              );
            })
          );

          assert.isFalse(
            called,
            '#after should not be called immediately after run()'
          );
        },
      });
    })(),

    '#beforeEach and #afterEach nesting'() {
      const dfd = this.async(5000);
      const outerTest = new Test({
        name: 'outerTest',
        test() {
          actualLifecycle.push('outerTest');
        },
      });
      const innerTest = new Test({
        name: 'innerTest',
        test() {
          actualLifecycle.push('innerTest');
        },
      });
      const suite = createSuite({
        name: 'foo',
        before() {
          actualLifecycle.push('outerSetup');
        },
        beforeEach(test) {
          const dfd = new _Deferred();
          setTimeout(function () {
            actualLifecycle.push(test.name + 'OuterBeforeEach');
            dfd.resolve();
          }, 100);
          return dfd.promise.then(() => {});
        },
        tests: [outerTest],
        afterEach(test) {
          actualLifecycle.push(test.name + 'OuterAfterEach');
        },
        after() {
          actualLifecycle.push('outerAfter');
        },
      });
      const childSuite = createSuite({
        name: 'child',
        parent: suite,
        before: function () {
          actualLifecycle.push('innerSetup');
        },
        beforeEach(test) {
          actualLifecycle.push(test.name + 'InnerBeforeEach');
        },
        tests: [innerTest],
        afterEach(test) {
          const dfd = new _Deferred();
          setTimeout(function () {
            actualLifecycle.push(test.name + 'InnerAfterEach');
            dfd.resolve();
          }, 100);
          return dfd.promise.then(() => {});
        },
        after: function () {
          actualLifecycle.push('innerAfter');
        },
      });
      const expectedLifecycle = [
        'outerSetup',
        'outerTestOuterBeforeEach',
        'outerTest',
        'outerTestOuterAfterEach',
        'innerSetup',
        'innerTestOuterBeforeEach',
        'innerTestInnerBeforeEach',
        'innerTest',
        'innerTestInnerAfterEach',
        'innerTestOuterAfterEach',
        'innerAfter',
        'outerAfter',
      ];
      const actualLifecycle: string[] = [];

      suite.tests.push(childSuite);
      suite.run().then(
        dfd.callback(function () {
          assert.deepEqual(
            actualLifecycle,
            expectedLifecycle,
            'Nested beforeEach and afterEach should execute in a pyramid, ' +
              'with the test passed to beforeEach and afterEach'
          );
        }),
        function (error) {
          console.log('suite failed with', error);
          dfd.reject(new Error('Suite should not fail'));
        }
      );
    },

    '#afterEach nesting with errors'() {
      const dfd = this.async(1000);
      const suite = createSuite({
        name: 'foo',
        afterEach: function () {
          actualLifecycle.push('outerAfterEach');
        },
      });
      const childSuite = createSuite({
        name: 'child',
        parent: suite,
        tests: [
          new Test({
            name: 'foo',
            test() {
              actualLifecycle.push('test');
            },
          }),
        ],
        afterEach() {
          actualLifecycle.push('innerAfterEach');
          throw new Error('Oops');
        },
      });
      const expectedLifecycle = ['test', 'innerAfterEach', 'outerAfterEach'];
      const actualLifecycle: string[] = [];

      suite.tests.push(childSuite);
      suite.run().then(
        dfd.callback(function () {
          assert.deepEqual(
            actualLifecycle,
            expectedLifecycle,
            'Outer afterEach should execute even though inner afterEach threw an error'
          );
          assert.strictEqual(
            childSuite.error!.message,
            'Oops',
            'Suite with afterEach failure should hold the last error from afterEach'
          );
        }),
        function () {
          dfd.reject(new Error('Suite should not fail'));
        }
      );
    },

    async 'timeElapsed is reported accurately when using stubbed timers'() {
      const clock = sandbox.useFakeTimers();
      clock.setSystemTime(200);

      const suite = createSuite({
        name: 'child',
        before() {},
        tests: [
          new Test({
            name: 'foo',
            test() {
              clock.setSystemTime(100);
            },
          }),
        ],
      });

      await suite.run();

      assert.isAtLeast(
        suite.timeElapsed!,
        0,
        'Time elapsed should not be negative'
      );
    },

    '#reset'() {
      const suite = createSuite();
      suite.remote = createMockRemote();
      suite.error = new Error();
      suite.timeElapsed = 100;

      suite.reset();
      assert.isUndefined(suite.remote);
      assert.isUndefined(suite.error);
      assert.strictEqual(suite.timeElapsed, 0);
    },

    '#run': <Tests>{
      grep: <Tests>{
        'only tests matching grep execute'() {
          const dfd = this.async(5000);
          const grep = /foo/;
          const testsRun: Test[] = [];
          const fooTest = new Test({
            name: 'foo',
            test() {
              testsRun.push(this);
            },
          });
          const barSuite = createSuite({
            name: 'bar',
            grep,
            tests: [
              new Test({
                name: 'foo',
                test() {
                  testsRun.push(this);
                },
              }),
              new Test({
                name: 'baz',
                test() {
                  testsRun.push(this);
                },
              }),
            ],
          });
          const foodTest = new Test({
            name: 'food',
            test() {
              testsRun.push(this);
            },
          });

          const suite = createSuite({
            name: 'grepSuite',
            grep,
            tests: [fooTest, barSuite, foodTest],
          });

          suite.run().then(
            dfd.callback(function () {
              assert.deepEqual(
                testsRun,
                [fooTest, barSuite.tests[0], foodTest],
                'Only test matching grep regex should have run'
              );
            }),
            function () {
              dfd.reject(new Error('Suite should not fail'));
            }
          );
        },
        ...createGrepLifecycleTests(),

        'executes the after and afterEach if the only test is skipped'() {
          const dfd = this.async(5000);
          let afterExecuted = false;
          let afterEachExecuted = false;
          const test = new Test({
            name: 'foo',
            test() {
              this.skip('skipped test');
            },
          });

          const suite = createSuite({
            name: 'my suite',
            bail: true,
            tests: [test],
            after() {
              afterExecuted = true;
            },
            afterEach() {
              afterEachExecuted = true;
            },
          });

          suite.run().then(
            dfd.callback(function () {
              assert.isTrue(afterExecuted, 'after should have run');
              assert.isTrue(afterEachExecuted, 'afterEach should have run');
            }),
            function () {
              dfd.reject(new Error('Suite should not fail'));
            }
          );
        },

        'changing a suite name should apply grep'() {
          const dfd = this.async(5000);
          const testsRun: Test[] = [];

          const fooTest = new Test({
            name: 'foo',
            test() {
              testsRun.push(this);
            },
          });

          const barTest = new Test({
            name: 'bar',
            test() {
              testsRun.push(this);
            },
          });

          const suite = createSuite({
            name: 'suite',
            grep: /intern - bar/,
            bail: true,
            tests: [fooTest, barTest],
          });

          suite.name = 'intern';

          suite.run().then(
            dfd.callback(function () {
              assert.sameMembers(
                testsRun,
                [barTest],
                'only bar should have run'
              );
            }),
            function () {
              dfd.reject(new Error('Suite should not fail'));
            }
          );
        },
      },

      'executes lifecycle functions for root suites'() {
        const dfd = this.async(5000);

        let beforeExecuted = false;
        let afterExecuted = false;

        const suite = createSuite({
          name: 'root suite',
          tests: [],
          executor: createMockExecutor(),
          before() {
            beforeExecuted = true;
          },
          after() {
            afterExecuted = true;
          },
        });

        suite.run().then(
          dfd.callback(function () {
            assert.isTrue(beforeExecuted, 'before should have run');
            assert.isTrue(afterExecuted, 'after should have run');
          }),
          function () {
            dfd.reject(new Error('Suite should not fail'));
          }
        );
      },

      bail() {
        const dfd = this.async(5000);
        const suite = createSuite({ name: 'bail', bail: true });
        const testsRun: any[] = [];
        const fooTest = new Test({
          name: 'foo',
          parent: suite,
          test() {
            testsRun.push(this);
          },
        });
        const barSuite = createSuite({
          name: 'bar',
          parent: suite,
          tests: [
            new Test({
              name: 'foo',
              test() {
                testsRun.push(this);
                // Fail this test; everything after this should not
                // run
                throw new Error('fail');
              },
            }),
            new Test({
              name: 'baz',
              test() {
                testsRun.push(this);
              },
            }),
          ],
        });
        const foodTest = new Test({
          name: 'food',
          parent: suite,
          test() {
            testsRun.push(this);
          },
        });

        let afterRan = false;
        barSuite.after = function () {
          afterRan = true;
        };

        suite.tests.push(fooTest);
        suite.tests.push(barSuite);
        suite.tests.push(foodTest);

        suite.run().then(
          dfd.callback(function () {
            assert.deepEqual(
              testsRun,
              [fooTest, barSuite.tests[0]],
              'Only tests before failing test should have run'
            );
            assert.isTrue(afterRan, 'after should have run for bailing suite');
          }),
          function () {
            dfd.reject(new Error('Suite should not fail'));
          }
        );
      },

      skip() {
        const dfd = this.async(5000);
        const suite = createSuite();
        const testsRun: any[] = [];
        const fooTest = new Test({
          name: 'foo',
          parent: suite,
          test() {
            testsRun.push(this);
          },
        });
        const barSuite = createSuite({
          name: 'bar',
          parent: suite,
          before() {
            this.skip('skip foo');
          },
          tests: [
            new Test({
              name: 'foo',
              test() {
                testsRun.push(this);
              },
            }),
            new Test({
              name: 'baz',
              test() {
                testsRun.push(this);
              },
            }),
          ],
        });
        const bazSuite = createSuite({
          name: 'baz',
          parent: suite,
          tests: [
            new Test({
              name: 'foo',
              test() {
                testsRun.push(this);
              },
            }),
            new Test({
              name: 'bar',
              test() {
                this.parent.skip();
                testsRun.push(this);
              },
            }),
            new Test({
              name: 'baz',
              test() {
                testsRun.push(this);
              },
            }),
          ],
        });

        suite.tests.push(fooTest);
        suite.tests.push(barSuite);
        suite.tests.push(bazSuite);

        // Expected result is that fooTest will run, barSuite will not run
        // (because the entire suite was skipped), and the first test in
        // bazSuite will run because the second test skips itself and the
        // remainder of the suite.

        suite.run().then(
          dfd.callback(function () {
            assert.deepEqual(
              testsRun,
              [fooTest, bazSuite.tests[0]],
              'Skipped suite should not have run'
            );
          }),
          function () {
            dfd.reject(new Error('Suite should not fail'));
          }
        );
      },

      cancel() {
        let test1Started = false;
        let test2Started = false;
        let beforeRun = false;
        let afterRun = false;

        const suite = createSuite({
          name: 'cancel suite',
          before() {
            beforeRun = true;
          },

          after() {
            afterRun = true;
          },
        });

        suite.tests.push(
          new Test({
            name: 'hanging',
            parent: suite,
            test() {
              test1Started = true;
              return new Promise((resolve) => setTimeout(resolve, 200));
            },
          })
        );

        suite.tests.push(
          new Test({
            name: 'hanging',
            parent: suite,
            test() {
              test2Started = true;
              return new Promise((resolve) => setTimeout(resolve, 200));
            },
          })
        );

        const runPromise = suite.run();

        setTimeout(() => {
          suite.cancel();
        }, 100);

        return runPromise.then(
          () => {
            throw new Error('Suite promise should not have resolved');
          },
          (error) => {
            assert.isTrue(beforeRun, 'expected before to have been run');
            assert.isTrue(test1Started, 'expected test 1 to have started');
            assert.isFalse(test2Started, 'expected test 2 not to have started');
            assert.isFalse(afterRun, 'expected after not to have run');
            assert.isTrue(isCancel(error), 'suite should have been cancelled');
          }
        );
      },
    },

    '#toJSON'() {
      const suite = new Suite({
        name: 'foo',
        executor: createMockExecutor(),
        tests: [new Test({ name: 'bar', test() {}, hasPassed: true })],
      });
      suite.error = {
        name: 'bad',
        message: 'failed',
        stack: '',
        lifecycleMethod: 'afterEach',
        relatedTest: <Test>suite.tests[0],
      };

      const expected = {
        name: 'foo',
        error: {
          name: 'bad',
          message: 'failed',
          stack: '',
          lifecycleMethod: 'afterEach',
          showDiff: false,
          relatedTest: {
            id: 'foo - bar',
            parentId: 'foo',
            name: 'bar',
            sessionId: '',
            timeout: 30000,
            hasPassed: true,
          },
        },
        id: 'foo',
        sessionId: '',
        hasParent: false,
        tests: [
          {
            id: 'foo - bar',
            parentId: 'foo',
            name: 'bar',
            sessionId: '',
            timeout: 30000,
            hasPassed: true,
          },
        ],
        numTests: 1,
        numFailedTests: 0,
        numPassedTests: 1,
        numSkippedTests: 0,
      };
      assert.deepEqual(suite.toJSON(), expected, 'Unexpected value');
    },

    'isFailedSuite()': {
      'due to error'() {
        const suite = createSuite({
          name: 'test',
          tests: [],
        });
        suite.error = new Error();

        assert.isTrue(isFailedSuite(suite));
      },

      'due to failed test'() {
        const test = new Test({
          name: 'bif',
          test() {},
        });
        const suite = createSuite({
          name: 'foo',
          tests: [test],
        });
        test.error = new Error();

        assert.isTrue(isFailedSuite(suite));
      },

      'no failure'() {
        const suite = createSuite({
          name: 'test',
          tests: [],
        });

        assert.isFalse(isFailedSuite(suite));
      },
    },
  },
});
