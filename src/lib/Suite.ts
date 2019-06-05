import {
  Task,
  CancellablePromise,
  isPromiseLike,
  isTask
} from '@theintern/common';

import Deferred from './Deferred';
import { Executor } from './executors/Executor';
import Test, { isTest, SKIP } from './Test';
import { InternError } from './types';
import { Remote } from './executors/Node';

/**
 * The Suite class manages a group of tests.
 */
export default class Suite implements SuiteProperties {
  /**
   * An optional method that is run after all the suite's tests have completed
   */
  after: SuiteLifecycleFunction | undefined;

  /**
   * An optional method that is run after each test has completed
   */
  afterEach: TestLifecycleFunction | undefined;

  /**
   * A convenience function that generates and returns a special
   * [[lib/Deferred.Deferred]] that can be used for asynchronous testing
   */
  async: ((timeout?: number) => Deferred<void>) | undefined;

  /**
   * An optional method that is run before any of this suite's tests are
   * started
   */
  before: SuiteLifecycleFunction | undefined;

  /**
   * An optional method that is run before each test
   */
  beforeEach: TestLifecycleFunction | undefined;

  /** The error that caused this suite to fail */
  error: InternError | undefined;

  /** This suite's parent Suite */
  parent: Suite | undefined;

  /**
   * If true, the suite will emit a suiteStart event after the `before`
   * callback has finished, and will emit a suiteEnd event before the `after`
   * callback has finished.
   */
  publishAfterSetup = false;

  /** The reason why this suite was skipped */
  skipped: string | undefined;

  /** The tests or other suites managed by this suite */
  tests: (Suite | Test)[] = [];

  /** The time required to run all the tests in this suite */
  timeElapsed: number | undefined;

  private _bail: boolean | undefined;
  private _executor: Executor | undefined;
  private _name: string | undefined;
  private _grep: RegExp | undefined;
  private _remote: Remote | undefined;
  private _sessionId: string | undefined;
  private _timeout: number | undefined;

  /**
   * @param options an object with default property values
   */
  constructor(options: SuiteOptions | RootSuiteOptions) {
    Object.keys(options)
      .filter(key => {
        return key !== 'tests';
      })
      .forEach(option => {
        const key = <keyof (SuiteOptions | RootSuiteOptions)>option;
        (this as any)[key] = options[key]!;
      });

    if (options.tests) {
      options.tests.forEach(suiteOrTest => this.add(suiteOrTest));
    }

    if (!this.name && this.parent) {
      throw new Error('A non-root Suite must have a name');
    }
  }

  /**
   * A flag used to indicate whether a test run should stop after a failed
   * test.
   */
  get bail() {
    return this._bail || (this.parent && this.parent.bail)!;
  }

  set bail(value: boolean) {
    this._bail = value;
  }

  /**
   * The executor used to run this Suite.
   */
  get executor(): Executor {
    // Prefer the parent's executor
    return (this.parent && this.parent.executor) || this._executor!;
  }

  set executor(value: Executor) {
    if (this._executor) {
      const error = new Error('An executor may only be set once per suite');
      error.name = 'AlreadyAssigned';
      throw error;
    }
    this._executor = value;
  }

  /**
   * A regular expression used to filter, by test ID, which tests are run.
   */
  get grep() {
    return this._grep || (this.parent && this.parent.grep) || /.*/;
  }

  set grep(value: RegExp) {
    this._grep = value;
    this._applyGrepToChildren();
  }

  /**
   * This suite's name
   */
  get name() {
    return this._name;
  }

  set name(value: string | undefined) {
    this._name = value;

    // If the name of the suite is set then we need to re-run the grep
    this._applyGrepToChildren();
  }

  /**
   * The unique identifier of the suite, assuming all combinations of suite +
   * test are unique.
   */
  get id() {
    let name: string[] = [];
    let suite: Suite = this;

    do {
      suite.name != null && name.unshift(suite.name);
    } while ((suite = suite.parent!));

    return name.join(' - ');
  }

  /**
   * The unique identifier of the suite's parent.
   */
  get parentId() {
    const parent = this.parent;
    if (parent) {
      return parent.id;
    }
  }

  /**
   * The WebDriver interface for driving a remote environment. This value is
   * only guaranteed to exist from the before/beforeEach/afterEach/after and
   * test methods, since environments are not instantiated until they are
   * actually ready to be tested against.
   */
  get remote() {
    return this.parent && this.parent.remote
      ? this.parent.remote
      : this._remote!;
  }

  set remote(value: Remote) {
    if (this._remote) {
      throw new Error('AlreadyAssigned: remote may only be set once per suite');
    }
    this._remote = value;
  }

  /**
   * The sessionId of the environment in which the suite executed.
   */
  get sessionId(): string {
    if (this.parent) {
      return this.parent.sessionId;
    }
    if (this._sessionId) {
      return this._sessionId;
    }
    if (this.remote) {
      return this.remote.session.sessionId;
    }
    return '';
  }

  set sessionId(value: string) {
    this._sessionId = value;
  }

  /**
   * The total number of tests in this suite and any sub-suites. To get only
   * the number of tests for this suite, look at `this.tests.length`.
   */
  get numTests(): number {
    return this.tests.reduce((numTests, suiteOrTest) => {
      if (isSuite(suiteOrTest)) {
        return numTests + suiteOrTest.numTests;
      }
      return numTests + 1;
    }, 0);
  }

  /**
   * The total number of tests in this test suite that passed.
   */
  get numPassedTests(): number {
    return this.tests.reduce((numPassedTests, suiteOrTest) => {
      if (isSuite(suiteOrTest)) {
        return numPassedTests + suiteOrTest.numPassedTests;
      } else if (suiteOrTest.hasPassed) {
        return numPassedTests + 1;
      }
      return numPassedTests;
    }, 0);
  }

  /**
   * The total number of tests in this test suite and any sub-suites that
   * failed.
   */
  get numFailedTests(): number {
    return this.tests.reduce((numFailedTests, suiteOrTest) => {
      if (isSuite(suiteOrTest)) {
        return numFailedTests + suiteOrTest.numFailedTests;
      } else if (suiteOrTest.error) {
        return numFailedTests + 1;
      }
      return numFailedTests;
    }, 0);
  }

  /**
   * The total number of tests in this test suite and any sub-suites that were
   * skipped.
   */
  get numSkippedTests(): number {
    return this.tests.reduce((numSkippedTests, suiteOrTest) => {
      if (isSuite(suiteOrTest)) {
        return numSkippedTests + suiteOrTest.numSkippedTests;
      } else if (suiteOrTest.skipped) {
        return numSkippedTests + 1;
      }
      return numSkippedTests;
    }, 0);
  }

  /**
   * Whether or not this suite has a parent (for parity with serialized
   * Suites).
   */
  get hasParent() {
    return Boolean(this.parent);
  }

  get timeout() {
    if (this._timeout != null) {
      return this._timeout;
    }
    if (this.parent) {
      return this.parent.timeout;
    }
    return 30000;
  }

  set timeout(value: number) {
    this._timeout = value;
  }

  /**
   * Add a test or suite to this suite.
   */
  add(suiteOrTest: Suite | Test) {
    if (!isTest(suiteOrTest) && !isSuite(suiteOrTest)) {
      throw new Error('Tried to add invalid suite or test');
    }

    if (suiteOrTest.parent != null && suiteOrTest.parent !== this) {
      throw new Error('This Suite or Test already belongs to another parent');
    }

    this.tests.forEach(existingSuiteOrTest => {
      if (existingSuiteOrTest.name === suiteOrTest.name) {
        throw new Error(
          `A suite or test named "${suiteOrTest.name}" has already been added`
        );
      }
    });

    suiteOrTest.parent = this;

    this.tests.push(suiteOrTest);
    this._applyGrepToSuiteOrTest(suiteOrTest);

    if (isTest(suiteOrTest)) {
      this.executor.emit('testAdd', suiteOrTest);
    } else {
      this.executor.emit('suiteAdd', suiteOrTest);
    }
  }

  private _applyGrepToSuiteOrTest(suiteOrTest: Suite | Test) {
    if (suiteOrTest instanceof Suite) {
      suiteOrTest._applyGrepToChildren();
    } else {
      const grepSkipReason = 'grep';
      if (suiteOrTest.skipped === grepSkipReason) {
        // If the test was previously skipped with a grep clear that it was skipped
        suiteOrTest.skipped = undefined;
      }

      if (!this.grep.test(suiteOrTest.id)) {
        suiteOrTest.skipped = grepSkipReason;
      }
    }
  }

  private _applyGrepToChildren() {
    this.tests.forEach(suiteOrTest =>
      this._applyGrepToSuiteOrTest(suiteOrTest)
    );
  }

  /**
   * Runs test suite in order:
   *
   * * before
   * * (for each test)
   *   * beforeEach
   *   * test
   *   * afterEach
   * * after
   *
   * If before, beforeEach, afterEach, or after throw, the suite itself will
   * be marked as failed and no further tests in the suite will be executed.
   */
  run(): CancellablePromise<void> {
    let startTime: number;

    // Run when the suite starts
    const start = () => {
      return this.executor.emit('suiteStart', this).then(function() {
        startTime = Date.now();
      });
    };

    // Run when the suite has ended
    const end = () => {
      this.timeElapsed = Date.now() - startTime;
      return this.executor.emit('suiteEnd', this);
    };

    // Important to check this outside of the lifecycle as skip may have been
    // called within a child
    const allTestsSkipped = this.numTests === this.numSkippedTests;

    // Run the before and after suite lifecycle methods
    const runLifecycleMethod = (
      suite: Suite,
      name: keyof Suite,
      test?: Test
    ): CancellablePromise<void> => {
      let result: PromiseLike<any> | void;

      // If we are the root suite with our own executor then we want to run life
      // cycle functions regardless of whether all tests are skipped
      if (!this._executor && allTestsSkipped) {
        // If all descendant tests are skipped then do not run the suite
        // lifecycles
        return Task.resolve();
      }

      return new Task<void>(
        (resolve, reject) => {
          let dfd: Deferred<any> | undefined;
          let timeout: number | undefined;

          // Provide a new Suite#async method for each call of a
          // lifecycle method since there's no concept of a Suite-wide
          // async deferred as there is for Tests.
          suite.async = function(_timeout?: number) {
            timeout = _timeout;

            const _dfd = new Deferred<any>();
            dfd = _dfd;

            suite.async = function() {
              return _dfd;
            };

            return _dfd;
          };

          const suiteFunc = suite[name] as
            | SuiteLifecycleFunction
            | TestLifecycleFunction;

          // Call the lifecycle function. The suite.async method above
          // may be called within this function call. If `test` is
          // defined (i.e., this is beforeEach or afterEach), pass it
          // first, followed by the suite. If `test` is not defined,
          // just pass the suite. This ordering is maintain backwards
          // compatibility with previous versions of Intern.
          result =
            suiteFunc &&
            (test
              ? (suiteFunc as TestLifecycleFunction).call(suite, test, suite)
              : (suiteFunc as SuiteLifecycleFunction).call(suite, suite));

          // If dfd is set, it means the async method was called
          if (dfd) {
            // Assign to a const so TS knows it's defined
            const _dfd = dfd;

            // If a timeout was set, async was called, so we should
            // use the dfd created by the call to manage the
            // timeout.
            if (timeout) {
              let timer = setTimeout(function() {
                const error = new Error(
                  `Timeout reached on ${suite.id}#${name}`
                );
                error.name = 'TimeoutError';
                _dfd.reject(error);
              }, timeout);

              _dfd.promise
                .catch(_error => {})
                .then(() => timer && clearTimeout(timer));
            }

            // If the return value looks like a promise, resolve the
            // dfd if the return value resolves
            if (isPromiseLike(result)) {
              result.then(() => _dfd.resolve(), error => _dfd.reject(error));
            }

            // Use the dfd.promise as the final result
            result = dfd.promise;
          }

          if (isPromiseLike(result)) {
            result.then(() => resolve(), reject);
          } else {
            resolve();
          }
        },
        () => {
          if (isTask(result)) {
            result.cancel();
          }
        }
      )
        .finally(() => {
          // Remove the async method since it should only be available
          // within a lifecycle function call
          suite.async = undefined;
        })
        .catch((error: InternError) => {
          if (error !== SKIP) {
            if (!this.error) {
              this.executor.log('Suite errored with non-skip error', error);
              this.error = error;
            }
            throw error;
          }
        });
    };

    // Convenience method to run 'before' suite lifecycle method
    const before = () => {
      return runLifecycleMethod(this, 'before');
    };

    // Convenience method to run the 'after' suite lifecycle method
    const after = () => {
      return runLifecycleMethod(this, 'after');
    };

    // Reset some state in case someone tries to re-run the same suite
    // TODO: Cancel any previous outstanding suite run
    // TODO: Test
    this.error = undefined;
    this.timeElapsed = 0;

    let task: CancellablePromise<void>;
    let runTask: CancellablePromise<void>;

    try {
      task = this.publishAfterSetup
        ? before().then(start)
        : start().then(before);
    } catch (error) {
      return Task.reject<void>(error);
    }

    // The task that manages running this suite's tests
    return task
      .then(() => {
        // Run the beforeEach or afterEach methods for a given test in
        // the proper order based on the current nested Suite structure
        const runTestLifecycle = (
          name: keyof Suite,
          test: Test
        ): CancellablePromise<void> => {
          let methodQueue: Suite[] = [];
          let suite: Suite = this;

          do {
            if (name === 'beforeEach') {
              // beforeEach executes in order parent -> child;
              methodQueue.push(suite);
            } else {
              // afterEach executes in order child -> parent
              methodQueue.unshift(suite);
            }
          } while ((suite = suite.parent!));

          let currentMethod: CancellablePromise<any>;

          return new Task(
            (resolve, reject) => {
              let firstError: Error;

              const handleError = (error: Error) => {
                // Note that a SKIP error will only be treated
                // as a 'skip' when thrown from beforeEach. If
                // thrown from afterEach it will be a suite
                // error.
                if (name === 'afterEach') {
                  firstError = firstError || error;
                  next();
                } else {
                  reject(error);
                }
              };

              const next = () => {
                const suite = methodQueue.pop();

                if (!suite) {
                  firstError ? reject(firstError) : resolve();
                  return;
                }

                currentMethod = runLifecycleMethod(suite, name, test).then(
                  next,
                  handleError
                );
              };

              next();
            },
            () => {
              methodQueue.splice(0, methodQueue.length);
              if (currentMethod) {
                currentMethod.cancel();
              }
            }
          );
        };

        let i = 0;
        let tests = this.tests;
        let current: CancellablePromise<void>;

        // Run each of the tests in this suite
        runTask = new Task<void>(
          (resolve, reject) => {
            let firstError: Error;
            let testTask: CancellablePromise<void> | undefined;

            const next = () => {
              const test = tests[i++];

              // The task is over when there are no more tests to
              // run
              if (!test) {
                firstError ? reject(firstError) : resolve();
                return;
              }

              const handleError = (error: InternError) => {
                // An error may be associated with a deeper test
                // already, in which case we do not want to
                // reassociate it with a more generic parent
                if (error && error.relatedTest == null) {
                  error.relatedTest = <Test>test;
                }
              };

              const runTest = () => {
                // Errors raised when running child tests should
                // be reported but should not cause this suite’s
                // run to reject, since this suite itself has
                // not failed.
                const result = test.run().catch(error => {
                  handleError(error);
                });
                testTask = new Task<void>(
                  resolve => {
                    result.then(resolve);
                  },
                  () => {
                    result.cancel();
                  }
                );
                return testTask;
              };

              // If the suite will be skipped, mark the current
              // test as skipped. This will skip both individual
              // tests and nested suites.
              if (this.skipped != null) {
                test.skipped = this.skipped;
              }

              // test is a suite
              if (isSuite(test)) {
                current = runTest();
              } else {
                if (test.skipped != null) {
                  current = this.executor.emit('testEnd', test);
                } else {
                  current = runTestLifecycle('beforeEach', test)
                    .then(() => {
                      // A test may have been skipped in a
                      // beforeEach call
                      if (test.skipped != null) {
                        return this.executor.emit('testEnd', test);
                      } else {
                        return runTest();
                      }
                    })
                    .finally(() => {
                      if (testTask) {
                        testTask.cancel();
                      }
                      testTask = undefined;
                      return runTestLifecycle('afterEach', test);
                    })
                    .catch(error => {
                      firstError = firstError || error;
                      return handleError(error);
                    });
                }
              }

              current.then(() => {
                const skipRestOfSuite = () => {
                  this.skipped =
                    this.skipped != null ? this.skipped : BAIL_REASON;
                };

                // If the test was a suite and the suite was
                // skipped due to bailing, skip the rest of this
                // suite
                if (isSuite(test) && test.skipped === BAIL_REASON) {
                  skipRestOfSuite();
                } else if (test.error && this.bail) {
                  // If the test errored and bail mode is
                  // enabled, skip the rest of this suite
                  skipRestOfSuite();
                }

                next();
              });
            };

            next();
          },
          () => {
            // Ensure no more tests will run
            i = Infinity;
            if (current) {
              current.cancel();
            }
          }
        );

        return runTask;
      })
      .finally(() => {
        if (runTask) {
          runTask.cancel();
        }
      })
      .finally(() => (this.publishAfterSetup ? end() : after()))
      .finally(() => (this.publishAfterSetup ? after() : end()));
  }

  /**
   * Skips this suite.
   *
   * Calling this function will cause all remaining tests in the suite to be
   * skipped. If a message was provided, a reporter may report the suite’s
   * tests as skipped. Skipped tests are not treated as passing or failing.
   *
   * If this method is called from a test function (as this.parent.skip()),
   * the test will be immediately halted, just as if the test’s own skip
   * method were called.
   *
   * @param message If provided, will be stored in this suite's `skipped`
   * property.
   */
  skip(message: string = 'suite skipped') {
    this.skipped = message;
    // Use the SKIP constant from Test so that calling Suite#skip from a
    // test won't fail the test.
    throw SKIP;
  }

  toJSON(): object {
    const json: { [key: string]: any } = {
      hasParent: Boolean(this.parent),
      tests: this.tests.map(test => test.toJSON())
    };
    const properties: (keyof Suite)[] = [
      'name',
      'id',
      'parentId',
      'sessionId',
      'timeElapsed',
      'numTests',
      'numPassedTests',
      'numFailedTests',
      'numSkippedTests',
      'skipped'
    ];

    properties.forEach(key => {
      const value = this[key];
      if (typeof value !== 'undefined') {
        json[key] = value;
      }
    });

    if (this.error) {
      json.error = {
        name: this.error.name,
        message: this.error.message,
        stack: this.error.stack
      };

      if (this.error.relatedTest && this.error.relatedTest !== <any>this) {
        // relatedTest can be the Suite itself in the case of nested
        // suites (a nested Suite's error is caught by a parent Suite,
        // which assigns the nested Suite as the relatedTest, resulting
        // in nestedSuite.relatedTest === nestedSuite); in that case,
        // don't serialize it
        json.error.relatedTest = this.error.relatedTest.toJSON();
      }
    }

    return json;
  }
}

export function isSuite(value: any): value is Suite {
  return Array.isArray(value.tests) && typeof value.hasParent === 'boolean';
}

export interface SuiteLifecycleFunction {
  (this: Suite, suite: Suite): void | PromiseLike<any>;
}

export interface TestLifecycleFunction {
  (this: Suite, test: Test, suite: Suite): void | PromiseLike<any>;
}

/**
 * Properties that can be set on a Suite.
 *
 * Note that 'tests' isn't included so that other interfaces, such as the object
 * interface, can use a different definition for it.
 */
export interface SuiteProperties {
  after: SuiteLifecycleFunction | undefined;
  afterEach: TestLifecycleFunction | undefined;
  bail: boolean | undefined;
  before: SuiteLifecycleFunction | undefined;
  beforeEach: TestLifecycleFunction | undefined;
  grep: RegExp;
  name: string | undefined;
  publishAfterSetup: boolean;
  timeout: number;
}

/**
 * Options that can be passed into a Suite constructor to initialize a suite
 */
export type SuiteOptions = Partial<SuiteProperties> & {
  name: string;
  parent: Suite;
  tests?: (Suite | Test)[];
};

/**
 * Options that can be passed into a Suite constructor to initialize a root
 * suite
 */
export type RootSuiteOptions = Partial<SuiteProperties> & {
  executor: Executor;
  tests?: (Suite | Test)[];
};

// BAIL_REASON needs to be a string so that Intern can tell when a remote has
// bailed during unit tests so that it can skip functional tests.
const BAIL_REASON = 'bailed';
