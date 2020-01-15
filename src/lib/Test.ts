import {
  Task,
  CancellablePromise,
  isPromiseLike,
  isTask
} from '@theintern/common';

import { Executor } from './executors/Executor';
import Deferred from './Deferred';
import { InternError } from './types';
import { Remote } from './executors/Node';
import Suite from './Suite';
import { errorToJSON } from './common/util';

/**
 * A Test is a single unit or functional test.
 */
export default class Test implements TestProperties {
  /** The name of this test */
  name!: string;

  /** This test's parent Suite */
  parent!: Suite;

  /** If this test was skipped, this will contain a message indicating why */
  skipped: string | undefined;

  /** The test function that is run by this Test */
  test!: TestFunction;

  /** The error that caused this Test to fail */
  error: InternError | undefined;

  /** A suite lifecycle error that occurred after executing this Test */
  suiteError: InternError | undefined;

  protected _hasPassed = false;

  protected _isAsync = false;

  protected _timeout: number | undefined;

  protected _runTask: CancellablePromise<any> | undefined;

  protected _timeElapsed: number | undefined;

  // Use type 'any' because we may be running under Node (NodeJS.Timer) or a
  // browser (number)
  protected _timer: any | undefined;

  protected _usesRemote = false;

  constructor(
    options: TestOptions & { timeElapsed?: number; hasPassed?: boolean }
  ) {
    if (!options.name || !options.test) {
      throw new Error('A Test requires a name and a test function');
    }

    ['timeElapsed', 'hasPassed'].forEach(property => {
      const name = <keyof TestOptions>property;
      if (options[name] != null) {
        (<any>this)[`_${name}`] = options[name];
      }
      delete options[name];
    });

    Object.assign(this, options);
  }

  /**
   * The executor running this test.
   */
  get executor(): Executor {
    return this.parent && this.parent.executor;
  }

  /**
   * True if the test function completed successfully
   */
  get hasPassed() {
    return this._hasPassed;
  }

  /**
   * The unique identifier of the test, assuming all combinations of suite +
   * test are unique.
   */
  get id() {
    let name: string[] = [];
    let suiteOrTest: Suite | Test = this;

    do {
      suiteOrTest.name != null && name.unshift(suiteOrTest.name);
    } while ((suiteOrTest = suiteOrTest.parent as Suite | Test));

    return name.join(' - ');
  }

  /**
   * If true, this Test's test function is async
   */
  get isAsync() {
    return this._isAsync;
  }

  /**
   * The unique identifier of the test's parent.
   */
  get parentId() {
    return this.parent.id;
  }

  /**
   * The WebDriver interface for driving a remote environment.
   * @see Suite#remote
   */
  get remote(): Remote {
    this._usesRemote = true;
    return this.parent.remote;
  }

  /**
   * An identifier for the test session this Test is running in.
   */
  get sessionId() {
    return this.parent.sessionId;
  }

  /**
   * The number of milliseconds the test function took to complete.
   */
  get timeElapsed() {
    return this._timeElapsed;
  }

  /**
   * The number of milliseconds this test can run before it will be canceled.
   */
  get timeout() {
    if (this._timeout != null) {
      return this._timeout;
    }
    if (this.parent && this.parent.timeout != null) {
      return this.parent.timeout;
    }
    return 30000;
  }

  set timeout(value) {
    this._timeout = value;
  }

  /**
   * This is a convenience function that generates and returns a special
   * [[lib/Deferred.Deferred]] that can be used for asynchronous testing.
   *
   * Once this method is called, a test is assumed to be asynchronous no
   * matter its return value (the generated Deferred's promise will always be
   * used as the implied return value if a promise is not returned by the test
   * function).
   *
   * The optional `numCallsUntilResolution` argument to `async` affects how the
   * callback method operates. By default, the Deferred is resolved (assuming
   * it hasn’t already been rejected) the first time the function returned by
   * `callback` is called. If `numCallsUntilResolution` is set (it must be a
   * value > 0), the function returned by `callback` must be called
   * `numCallsUntilResolution` times before the Deferred resolves.
   *
   * @param timeout If provided, the amount of time to wait before rejecting
   * the test with a timeout error, in milliseconds.
   * @param numCallsUntilResolution The number of times that resolve needs to
   * be called before the Deferred is actually resolved.
   * @returns a lib/Deferred that can be used to resolve the test
   */
  async(timeout?: number, numCallsUntilResolution?: number): Deferred<any> {
    this._isAsync = true;

    if (timeout != null) {
      this.timeout = timeout;
    }

    let remainingCalls = numCallsUntilResolution || 1;
    const dfd = new Deferred();
    const oldResolve = dfd.resolve;

    /**
     * Eventually resolves the deferred, once `resolve` has been called as
     * many times as specified by the `numCallsUntilResolution` parameter of
     * the original `async` call.
     */
    dfd.resolve = function<T>(this: any, value?: T) {
      --remainingCalls;
      if (remainingCalls === 0) {
        oldResolve.call(this, value);
      } else if (remainingCalls < 0) {
        throw new Error('resolve called too many times');
      }
    };

    // A test may call this function multiple times and should always get
    // the same Deferred
    this.async = function() {
      return dfd;
    };

    return dfd;
  }

  /**
   * During an asynchronous test run, restarts the timeout timer.
   */
  restartTimeout(timeout?: number) {
    if (timeout != null) {
      this.timeout = timeout;
    }

    if (this._runTask) {
      if (this._timer) {
        clearTimeout(this._timer);
      }
      this._timer = setTimeout(() => {
        this._timer = undefined;
        if (this._runTask) {
          const error = new Error(`Timeout reached on ${this.id}#`);
          error.name = 'TimeoutError';
          this.error = error;
          this._runTask.cancel();
        }
      }, this.timeout);
    }
  }

  /**
   * Runs the test.
   */
  run() {
    let startTime: number;

    // Cancel any currently running test
    if (this._runTask) {
      this._runTask.cancel();
      this._runTask = undefined;
    }

    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }

    // Reset some state in case someone tries to re-run the same test
    this._usesRemote = false;
    this._hasPassed = false;
    this._isAsync = false;
    this._timeElapsed = 0;
    this._runTask = undefined;
    this.async = Object.getPrototypeOf(this).async;
    this.error = undefined;
    this.skipped = undefined;

    return this.executor
      .emit('testStart', this)
      .then(() => {
        startTime = Date.now();
      })
      .then<void>(() => {
        let result: PromiseLike<any> | void = this.test(this);

        // Someone called `this.async`, so this test is async; we have
        // to prefer one or the other, so prefer the promise returned
        // from the test function if it exists, otherwise get the one
        // that was generated by `Test#async`
        if (this.isAsync) {
          if (!isPromiseLike(result)) {
            result = this.async().promise;
          } else {
            // If the user called this.async and returned a
            // thenable, wait for the first one to resolve or
            // reject.
            result = Task.race([this.async().promise, result]);
          }
        }

        if (isPromiseLike(result)) {
          // Even if a user did not call `this.async`, we still mark
          // this test as asynchronous if a promise was returned
          this._isAsync = true;

          // Wrap the runTask in another Task so that a canceled test
          // can be treated like a skip.
          return new Task((resolve, reject) => {
            this._runTask = new Task(
              (resolve, reject) => {
                let settled = false;

                if (isPromiseLike(result)) {
                  result.then(
                    () => {
                      settled = true;
                      resolve();
                    },
                    error => {
                      settled = true;
                      reject(error);
                    }
                  );
                }

                // Most promise implementations that allow
                // cancellation don't signal that a promise was
                // canceled. In order to ensure that a timed out
                // test is never accidentally resolved, reject a
                // canceled test, treating it as a skipped test.
                if (isTask(result)) {
                  result
                    // Reject with SKIP in case we got here
                    // before the promise resolved
                    .finally(() => {
                      if (!settled) {
                        this.skipped = 'Canceled';
                        reject(SKIP);
                      }
                    })
                    // If the result rejected, consume the
                    // error; it's handled above
                    .catch(_error => {});
                }
              },
              () => {
                // Only cancel the result if it's actually a
                // Task
                if (isTask(result)) {
                  result.cancel();
                }
                // If the test task was canceled between the
                // time it failed and the time it resolved,
                // reject it
                if (this.error) {
                  reject(this.error);
                }
              }
            ).then(() => {
              resolve();
            }, reject);

            this.restartTimeout();
          });
        }
      })
      .finally(() => {
        // If we got here but the test task hasn't finished, the test
        // was canceled
        if (this._runTask) {
          this._runTask.cancel();
        }

        this._runTask = undefined;
        this._timeElapsed = Date.now() - startTime;

        // Ensure the timeout timer is cleared so the testing process
        // doesn't hang at exit
        if (this._timer) {
          clearTimeout(this._timer);
          this._timer = undefined;
        }
      })
      .then(() => {
        // Test completed successfully -- potentially passed
        if (this._usesRemote && !this.isAsync) {
          throw new Error(
            'Remote used in synchronous test! Tests using this.remote must ' +
              'return a promise or resolve a this.async deferred.'
          );
        }
        this._hasPassed = true;
      })
      .catch(error => {
        // There was an error running the test; could be a skip, could
        // be an assertion failure
        if (error === SKIP) {
          if (!this.skipped) {
            // The parent was skipped while running the test
            const parentSkipped = this.parent && this.parent.skipped;
            this.skipped = parentSkipped || 'suite skipped';
          }
        } else {
          this.error = error;
          throw error;
        }
      })
      .finally(() => this.executor.emit('testEnd', this));
  }

  /**
   * Skips this test.
   *
   * Calling this function will cause a test to halt immediately. If a message
   * was provided, a reporter may report the test as skipped. Skipped tests
   * are not treated as passing or failing.
   *
   * @param message If provided, will be stored in this test's `skipped`
   * property.
   */
  skip(message: string = 'skipped') {
    this.skipped = message;
    throw SKIP;
  }

  /**
   * Return a JSON-representation of this test
   */
  toJSON() {
    const json: { [key: string]: any } = {};
    const properties: (keyof Test)[] = [
      'id',
      'parentId',
      'name',
      'sessionId',
      'timeElapsed',
      'timeout',
      'hasPassed',
      'skipped'
    ];

    properties.forEach(key => {
      const value = this[key];
      if (typeof value !== 'undefined') {
        json[key] = value;
      }
    });

    if (this.suiteError) {
      json.suiteError = errorToJSON(this.suiteError);
    }

    if (this.error) {
      json.error = errorToJSON(this.error);
    }

    return json;
  }
}

export function isTest(value: any): value is Test {
  return (
    value != null &&
    typeof value.test === 'function' &&
    typeof value.hasPassed === 'boolean'
  );
}

export function isTestOptions(value: any): value is TestOptions {
  return (
    value != null &&
    !(value instanceof Test) &&
    value.name != null &&
    value.test != null
  );
}

export interface TestFunction {
  (this: Test, test: Test): void | PromiseLike<any>;
}

export function isTestFunction(value: any): value is TestFunction {
  return typeof value === 'function';
}

export interface TestProperties {
  hasPassed: boolean;
  name: string;
  parent: Suite;
  skipped: string | undefined;
  test: TestFunction;
  timeout: number;
}

export type TestOptions = Partial<TestProperties> & {
  name: string;
  test: TestFunction;
};

export const SKIP: any = {};
