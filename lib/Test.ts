import Promise = require('dojo/Promise');
import Suite from './Suite';
import { StackError } from './util';

const SKIP = <Error> {};

type MaybePromise = any | Promise.Thenable<any>;

interface TestDeferred<T> extends Promise.Deferred<T> {
	callback<U extends (...args: any[]) => any>(callback: U): U;
	rejectOnError<U extends (...args: any[]) => any>(callback: U): U;
}

export default class Test {
	name: string;
	error: Error;
	hasPassed: boolean = false;
	isAsync: boolean = false;
	parent: Suite;
	skipped: string;
	test: () => MaybePromise;
	timeElapsed: number;

	constructor(kwArgs: KwArgs) {
		for (let k in kwArgs) {
			(<any> this)[k] = (<any> kwArgs)[k];
		}

		if (this.reporterManager) {
			this.reporterManager.emit('newTest', this);
		}
	}

	/**
	 * The unique identifier of the test, assuming all combinations of suite + test are unique.
	 */
	get id() {
		const name: string[] = [];
		let object: Suite | Test = this;

		do {
			object.name != null && name.unshift(object.name);
		} while ((object = object.parent));

		return name.join(' - ');
	}

	/**
	 * The WebDriver interface for driving a remote environment.
	 * @see Suite#remote
	 */
	get remote() {
		return this.parent.remote;
	}

	get reporterManager() {
		return this.parent && this.parent.reporterManager;
	}

	get sessionId() {
		return this.parent.sessionId;
	}

	protected _timeout: number;
	get timeout() {
		if (this._timeout != null) {
			return this._timeout;
		}
		else if (this.parent) {
			return this.parent.timeout;
		}
		else {
			return 30000;
		}
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
	 * @param timeout
	 * If provided, the amount of time to wait before rejecting the test with a timeout error, in milliseconds.
	 *
	 * @param numCallsUntilResolution
	 * The number of times that resolve needs to be called before the Deferred is actually resolved.
	 *
	 * @returns {module:dojo/Promise.Deferred}
	 */
	async<T>(timeout?: number, numCallsUntilResolution?: number) {
		this.isAsync = true;

		if (timeout != null) {
			this.timeout = timeout;
		}

		if (!numCallsUntilResolution) {
			numCallsUntilResolution = 1;
		}

		const dfd = <TestDeferred<T>> new Promise.Deferred(function (reason) {
			throw reason;
		});
		const oldResolve = dfd.resolve;

		/**
		 * Eventually resolves the deferred, once `resolve` has been called as many times as specified by the
		 * `numCallsUntilResolution` parameter of the original `async` call.
		 */
		dfd.resolve = function () {
			--numCallsUntilResolution;
			if (numCallsUntilResolution === 0) {
				oldResolve.apply(this, arguments);
			}
			else if (numCallsUntilResolution < 0) {
				throw new Error('resolve called too many times');
			}
		};

		/**
		 * Wraps any callback to resolve the deferred so long as the callback executes without throwing any Errors.
		 */
		dfd.callback = function (callback: (...args: any[]) => any) {
			const self = this;
			return this.rejectOnError(function () {
				const returnValue = callback.apply(this, arguments);
				self.resolve();
				return returnValue;
			});
		};

		/**
		 * Wraps a callback to reject the deferred if the callback throws an Error.
		 */
		dfd.rejectOnError = function (callback: (...args: any[]) => any) {
			const self = this;
			return function () {
				try {
					return callback.apply(this, arguments);
				}
				catch (error) {
					self.reject(error);
				}
			};
		};

		// A test may call this function multiple times and should always get the same Deferred
		this.async = function () {
			return dfd;
		};

		return dfd;
	}

	protected _runTask: Promise<void>;
	protected _timer: number | NodeJS.Timer;

	/**
	 * During an asynchronous test run, restarts the timeout timer.
	 * @param {number} timeout
	 */
	restartTimeout(timeout?: number) {
		timeout = timeout == null ? this.timeout : timeout;

		if (this._runTask) {
			const self = this;
			clearTimeout(<any> this._timer);
			this._timer = setTimeout(function () {
				if (self._runTask) {
					const reason = new Error('Timeout reached on ' + self.id);
					reason.name = 'CancelError';
					self._runTask.cancel(reason);
				}
			}, timeout != null ? timeout : self.timeout);
		}
		else {
			this.timeout = timeout;
		}
	}

	/**
	 * Runs the test.
	 * @returns {dojo/promise/Promise}
	 */
	run() {
		const reporterManager = this.reporterManager;
		const self = this;
		let startTime: number;

		function end() {
			return report('testEnd');
		}

		function report(eventName: string) {
			if (reporterManager) {
				const args = [ eventName, self ].concat(Array.prototype.slice.call(arguments, 1));
				return reporterManager.emit.apply(reporterManager, args).catch(function () {});
			}
			else {
				return Promise.resolve(null);
			}
		}

		function start() {
			return report('testStart').then(function () {
				startTime = Date.now();
			});
		}

		// Reset some state in case someone tries to re-run the same test
		// TODO: Cancel any previous outstanding test run
		// TODO: Test
		this.async = Object.getPrototypeOf(this).async;
		this.hasPassed = this.isAsync = false;
		this.error = this.skipped = this.timeElapsed = null;

		return start()
			.then(function () {
				let result = self.test();

				// Someone called `this.async`, so this test is async; we have to prefer one or the other, so
				// prefer the promise returned from the test function if it exists, otherwise get the one that was
				// generated by `Test#async`
				if (self.isAsync && (!result || !result.then)) {
					result = self.async().promise;
				}

				if (result && result.then) {
					// If a user did not call `this.async` but returned a promise we still want to mark this
					// test as asynchronous for informational purposes
					self.isAsync = true;

					// The `result` promise is wrapped in order to allow timeouts to work when a user returns a
					// Promise from somewhere else that does not support cancellation
					self._runTask = new Promise<void>(function (resolve, reject, progress, setCanceler) {
						setCanceler(function (reason) {
							// Dojo 2 promises are designed to allow extra signalling if a task has to perform
							// cleanup when it is cancelled; some others, including Dojo 1 promises, do not. In
							// order to ensure that a timed out test is never accidentally resolved, always throw
							// or re-throw the cancel reason
							if (result.cancel) {
								const returnValue = result.cancel(reason);
								if (returnValue && returnValue.finally) {
									return returnValue.finally(function () {
										throw reason;
									});
								}
							}

							throw reason;
						});

						result.then(resolve, reject);
					});

					self.restartTimeout();
					return self._runTask;
				}
			})
			.finally(function () {
				self.timeElapsed = Date.now() - startTime;
				clearTimeout(<any> self._timer);
				self._timer = self._runTask = null;
			})
			.then(function () {
				self.hasPassed = true;
				return report('testPass');
			}, function (error: Error) {
				if (error === SKIP) {
					return report('testSkip');
				}
				else {
					self.error = error;
					// TODO: If a test fails it probably should not reject the `run` promise unless the failure was
					// inside the test system itself (and not just a test failure)
					return report('testFail').then(function () {
						throw error;
					});
				}
			})
			.finally(end);
	}

	/**
	 * Skips this test.
	 *
	 * @param {String} message
	 * If provided, will be stored in this test's `skipped` property.
	 */
	skip(message: string) {
		this.skipped = message || '';
		throw SKIP;
	}

	toJSON(): Json {
		return {
			name: this.name,
			sessionId: this.sessionId,
			id: this.id,
			timeout: this.timeout,
			timeElapsed: this.timeElapsed,
			hasPassed: this.hasPassed,
			skipped: this.skipped,
			error: this.error ? {
				name: this.error.name,
				message: this.error.message,
				stack: (<StackError> this.error).stack
			} : null
		};
	}
}

export interface Json {
	name: string;
	sessionId: string;
	id: string;
	timeout: number;
	timeElapsed: number;
	hasPassed: boolean;
	skipped: string;
	error: StackError;
}

export interface KwArgs {
	name?: string;
	parent?: Suite;
	test?: () => MaybePromise;
	timeout?: number;
}
