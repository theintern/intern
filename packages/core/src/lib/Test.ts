import {
  isPromise,
  isPromiseLike,
  isCancel,
  CancelToken,
  createCancelToken
} from '@theintern/common';
import { Executor } from './executors/Executor';
import Deferred from './Deferred';
import { InternError } from './types';
import { Remote } from './executors/Node';
import Suite from './Suite';
import { errorToJSON } from './common/util';
import { setTimeout, clearTimeout, now } from './common/time';

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

  protected _runPromise: Promise<any> | undefined;

  protected _cancelToken: CancelToken | undefined;

  protected _timeElapsed: number | undefined;

  private _asyncDfd: Deferred<unknown> | undefined;

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

    // TODO: remove the special treatment for timeElapsed and hasPassed if it's
    // just for testing
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
    const name: string[] = [];
    let suiteOrTest: Suite | Test | undefined = this;

    while (suiteOrTest != null) {
      suiteOrTest.name != null && name.unshift(suiteOrTest.name);
      suiteOrTest = suiteOrTest.parent;
    }

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
   * The number of milliseconds this test can run before it will be cancelled.
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
    if (this._asyncDfd) {
      return this._asyncDfd;
    }

    this._isAsync = true;

    if (timeout != null) {
      this.timeout = timeout;
    }

    const dfd = new Deferred<unknown>(
      this._cancelToken,
      numCallsUntilResolution ?? 1
    );
    this._asyncDfd = dfd;

    return dfd;
  }

  /**
   * Cancel this test if it's in-progress.
   *
   * This method has no effect if the Test has finished.
   */
  cancel(reason?: string) {
    this._cancelToken?.cancel(reason);
  }

  /**
   * During an asynchronous test run, restarts the timeout timer.
   */
  restartTimeout(timeout?: number) {
    if (timeout != null) {
      this.timeout = timeout;
    }

    clearTimeout(this._timer);

    this._timer = setTimeout(() => {
      this._timer = undefined;
      const error = new Error(`Timeout reached on ${this.id}#`);
      error.name = 'TimeoutError';
      this.error = error;

      // The timer is cancelled at the begining and and end of a test run, so
      // _cancelToken will be defined when this timer fires
      this._cancelToken?.cancel(error);
    }, this.timeout);
  }

  /**
   * Runs the test.
   */
  run(token?: CancelToken) {
    let startTime: number;

    // Cancel the currnet test run if one is active
    this._cancelToken?.cancel();

    clearTimeout(this._timer);
    this._timer = undefined;

    // Reset some state in case someone tries to re-run the same test
    this._usesRemote = false;
    this._hasPassed = false;
    this._isAsync = false;
    this._timeElapsed = 0;
    this._runPromise = undefined;
    this._cancelToken = undefined;
    this._asyncDfd = undefined;
    this.error = undefined;
    this.skipped = undefined;

    // Create a token that can be used to cancel the test, or use the one that
    // was provided
    const cancelToken = createCancelToken();
    this._cancelToken = cancelToken;

    // If the passed-in cancel token is cancelled, cancel this run's token as
    // well.
    if (token) {
      // If the token is already cancelled, don't try to run the test
      if (token.reason) {
        return Promise.reject(token.reason);
      }
      token.promise.catch(() => cancelToken.cancel());
    }

    return this.executor
      .emit('testStart', this)
      .then(() => {
        startTime = now();
      })
      .then<void>(() => {
        let result: Promise<any> | void = this.test(this);

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
            result = Promise.race([this.async().promise, result]);
          }
        }

        if (isPromise(result)) {
          // Even if a user did not call `this.async`, we still mark
          // this test as asynchronous if a promise was returned
          this._isAsync = true;

          this.restartTimeout();

          return cancelToken.wrap(result).catch(error => {
            // Record a cancelled test as skipped
            if (isCancel(error)) {
              this.skipped = 'Cancelled';
            }
            throw error;
          });
        }
      })
      .finally(() => {
        this._runPromise = undefined;
        this._cancelToken = undefined;
        this._timeElapsed = now() - startTime;

        // Ensure the timeout timer is cleared so the testing process
        // doesn't hang at exit
        clearTimeout(this._timer);
        this._timer = undefined;
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
        // There was an error running the test; if it wasn't a skip or a cancel,
        // assocate the error with the test and rethrow it
        if (!isSkip(error)) {
          if (!isCancel(error)) {
            this.error = error;
          }
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
  skip(message = 'skipped') {
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
  (this: Test, test: Test): void | Promise<any>;
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

export function isSkip(reason: any): boolean {
  return reason === SKIP;
}
