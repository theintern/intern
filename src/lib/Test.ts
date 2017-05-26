import Executor from './executors/Executor';
import Deferred from './Deferred';
import Task, { isTask, isThenable } from '@dojo/core/async/Task';
import { Thenable } from '@dojo/shim/interfaces';
import { InternError } from './types';
import { Remote } from './executors/Node';
import Suite from './Suite';
import { mixin } from '@dojo/core/lang';

export default class Test implements TestProperties {
	/** The name of this test */
	name: string;

	/** This test's parent Suite */
	parent: Suite;

	/** If this test was skipped, this will contain a message indicating why */
	skipped: string | undefined;

	/** The test function that is run by this Test */
	test: TestFunction;

	/** The error that caused this Test to fail */
	error: InternError | undefined;

	protected _hasPassed = false;

	protected _isAsync = false;

	protected _timeout: number;

	protected _runTask: Task<any> | null;

	protected _timeElapsed: number;

	protected _timer: NodeJS.Timer | null;

	protected _usesRemote = false;

	constructor(options: TestOptions) {
		if (!options.name || !options.test) {
			throw new Error('A Test requires a name and a test function');
		}

		if (options.hasPassed != null) {
			this._hasPassed = options.hasPassed;
		}
		delete options.hasPassed;

		mixin(this, options);
	}

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
	 * The unique identifier of the test, assuming all combinations of suite + test are unique.
	 */
	get id() {
		let name: string[] = [];
		let suiteOrTest: (Suite | Test) = this;

		do {
			suiteOrTest.name != null && name.unshift(suiteOrTest.name);
		} while ((suiteOrTest = suiteOrTest.parent));

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

	get sessionId() {
		return this.parent.sessionId;
	}

	/**
	 * Return the number of milliseconds required for the test function to complete
	 */
	get timeElapsed() {
		return this._timeElapsed;
	}

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
	 * A convenience function that generates and returns a special Deferred that can be used for asynchronous
	 * testing.
	 * Once called, a test is assumed to be asynchronous no matter its return value (the generated Deferred's
	 * promise will always be used as the implied return value if a promise is not returned by the test function).
	 *
	 * @param timeout If provided, the amount of time to wait before rejecting the test with a timeout error, in milliseconds.
	 * @param numCallsUntilResolution The number of times that resolve needs to be called before the Deferred is actually resolved.
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
		 * Eventually resolves the deferred, once `resolve` has been called as many times as specified by the
		 * `numCallsUntilResolution` parameter of the original `async` call.
		 */
		dfd.resolve = function (this: any) {
			--remainingCalls;
			if (remainingCalls === 0) {
				oldResolve.apply(this, arguments);
			}
			else if (remainingCalls < 0) {
				throw new Error('resolve called too many times');
			}
		};

		// A test may call this function multiple times and should always get the same Deferred
		this.async = function () {
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
				this._timer = null;
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

		// Reset some state in case someone tries to re-run the same test
		// TODO: Cancel any previous outstanding test run
		// TODO: Test
		this.async = Object.getPrototypeOf(this).async;
		this._usesRemote = false;
		this._hasPassed = false;
		this._isAsync = false;
		this._timeElapsed = 0;
		this.error = undefined;
		this.skipped = undefined;

		return this.executor.emit('testStart', this)
			.then(() => {
				startTime = Date.now();
			})
			.then(() => {
				let result: Thenable<void> | void = this.test();

				// Someone called `this.async`, so this test is async; we have to prefer one or the other, so
				// prefer the promise returned from the test function if it exists, otherwise get the one that was
				// generated by `Test#async`
				if (this.isAsync) {
					if (!isThenable(result)) {
						result = this.async().promise;
					}
					else {
						// If the user called this.async and returned a thenable, wait for the first one to resolve or
						// reject.
						result = Task.race<Task<void>, void>([this.async().promise, result]);
					}
				}

				if (isThenable(result)) {
					// If a user did not call `this.async` but returned a promise we still want to mark this
					// test as asynchronous for informational purposes
					this._isAsync = true;

					// The `result` promise is wrapped in order to allow timeouts to work when a user returns a
					// Promise from somewhere else that does not support cancellation
					return new Task((resolve, reject) => {
						this._runTask = new Task(
							(resolve, reject) => {
								if (isThenable(result)) {
									result.then(resolve, reject);
								}

								// Most promise implementations that allow cancellation don't signal that a promise was
								// canceled. In order to ensure that a timed out test is never accidentally resolved, reject
								// a canceled test.
								if (isTask(result)) {
									result.finally(reject).catch(() => {});
								}
							},
							() => {
								if (isTask(result)) {
									result.cancel();
								}
								reject(this.error);
							}
						).then(resolve, reject);

						this.restartTimeout();
					});
				}
			})
			.finally(() => {
				this._timeElapsed = Date.now() - startTime;
				if (this._timer) {
					clearTimeout(this._timer);
					this._timer = null;
				}
				this._runTask = null;
			})
			.then(
				// Test completed successfully -- potentially passed
				() => {
					if (this._usesRemote && !this.isAsync) {
						throw new Error('Remote used in synchronous test! Tests using this.remote must ' +
							'return a promise or resolve a this.async deferred.');
					}
					this._hasPassed = true;
				},
				// There was an error running the test; could be a skip, could be an assertion failure
				error => {
					if (error === SKIP) {
						if (!this.skipped) {
							this.skipped = error.message;
						}
					}
					else {
						this.error = error;
						throw error;
					}
				}
			)
			.finally(() => this.executor.emit('testEnd', this));
	}

	/**
	 * Skips this test.
	 *
	 * @param message If provided, will be stored in this test's `skipped` property.
	 */
	skip(message: string = 'skipped') {
		this.skipped = message;
		throw SKIP;
	}

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

		if (this.error) {
			json.error = {
				name: this.error.name,
				message: this.error.message,
				stack: this.error.stack,
				showDiff: Boolean(this.error.showDiff)
			};

			if (this.error.showDiff) {
				json.error.actual = this.error.actual;
				json.error.expected = this.error.expected;
			}
		}

		return json;
	}
}

export function isTest(value: any): value is Test {
	return value != null && typeof value.test === 'function' && typeof value.hasPassed === 'boolean';
}

export function isTestOptions(value: any): value is TestOptions {
	return value != null && !(value instanceof Test) && value.name != null && value.test != null;
}

export interface TestFunction {
	(this: Test): void | Thenable<any>;
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
	name: string,
	test: TestFunction
};

export const SKIP: any = {};
