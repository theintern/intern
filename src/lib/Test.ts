import * as Promise from 'dojo/Promise';
import * as util from './util';
import { InternError, Remote, Deferred } from '../interfaces';
import { Suite } from './Suite';

export interface TestFunction {
	(test: Test): void | Promise<any>;
}

export interface TestDescriptor {
	name: string;
	parent: Suite;
	test: TestFunction;
	hasPassed?: boolean;
	skipped?: string;
}

export class Test {
	name: string;

	test: Function;

	parent: Suite;

	isAsync = false;

	timeElapsed: number;

	hasPassed: boolean = false;

	skipped: string;

	error: InternError;

	static SKIP: Object = {};

	private _timeout: number;

	private _runTask: Promise<any>;

	private _timer: number;

	private _usesRemote = false;

	constructor(descriptor: TestDescriptor) {
		for (let key in descriptor) {
			(<{ [key: string]: any }> this)[key] = (<{ [key: string]: any }> descriptor)[key];
		}
		this.reporterManager && this.reporterManager.emit('newTest', this);
	}

	/**
	 * The unique identifier of the test, assuming all combinations of suite + test are unique.
	 */
	get id() {
		let name: string[] = [];
		let object: (Suite|Test) = this;

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
		this._usesRemote = true;
		return this.parent.remote;
	}

	get reporterManager() {
		return this.parent && this.parent.reporterManager;
	}

	get sessionId() {
		return this.parent.sessionId;
	}

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
	 * @param timeout If provided, the amount of time to wait before rejecting the test with a timeout error, in milliseconds.
	 *
	 * @param numCallsUntilResolution The number of times that resolve needs to be called before the Deferred is actually resolved.
	 *
	 * @returns {module:dojo/Promise.Deferred}
	 */
	async(timeout?: number, numCallsUntilResolution?: number): Deferred<any> {
		this.isAsync = true;

		if (timeout != null) {
			this.timeout = timeout;
		}

		if (!numCallsUntilResolution) {
			numCallsUntilResolution = 1;
		}

		const dfd = util.createDeferred();
		const oldResolve = dfd.resolve;

		/**
		 * Eventually resolves the deferred, once `resolve` has been called as many times as specified by the
		 * `numCallsUntilResolution` parameter of the original `async` call.
		 */
		dfd.resolve = function (this: any) {
			--numCallsUntilResolution;
			if (numCallsUntilResolution === 0) {
				oldResolve.apply(this, arguments);
			}
			else if (numCallsUntilResolution < 0) {
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
		timeout = timeout == null ? this.timeout : timeout;

		if (this._runTask) {
			clearTimeout(this._timer);
			const timer = setTimeout(() => {
				if (this._runTask) {
					let reason = new Error('Timeout reached on ' + this.id);
					reason.name = 'CancelError';
					this._runTask.cancel(reason);
				}
			}, timeout);
			this._timer = <number> (<any> timer);
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
				let args = [ eventName, self ].concat(Array.prototype.slice.call(arguments, 1));
				return reporterManager.emit.apply(reporterManager, args).catch(function () {});
			}
			else {
				return Promise.resolve();
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
		this._usesRemote = false;
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
					self._runTask = new Promise(function (resolve, reject, progress, setCanceler) {
						setCanceler(function (reason) {
							// Dojo 2 promises are designed to allow extra signalling if a task has to perform
							// cleanup when it is cancelled; some others, including Dojo 1 promises, do not. In
							// order to ensure that a timed out test is never accidentally resolved, always throw
							// or re-throw the cancel reason
							if (result.cancel) {
								let returnValue = result.cancel(reason);
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
				clearTimeout(self._timer);
				self._timer = self._runTask = null;
			})
			.then(
				function () {
					self.hasPassed = true;
					if (self._usesRemote && !self.isAsync) {
						throw new Error('Remote used in synchronous test! Tests using this.remote must return a ' +
							'promise or resolve a this.async deferred.');
					}
					return report('testPass');
				},
				function (error: any) {
					if (error === Test.SKIP) {
						return report('testSkip');
					}
					else {
						self.error = error;
						// TODO: If a test fails it probably should not reject the `run` promise unless the failure
						// was inside the test system itself (and not just a test failure)
						return report('testFail').then(function () {
							throw error;
						});
					}
				}
			)
			.finally(end);
	}

	/**
	 * Skips this test.
	 *
	 * @param message If provided, will be stored in this test's `skipped` property.
	 */
	skip(message: string = '') {
		this.skipped = message;
		throw Test.SKIP;
	}

	toJSON() {
		let error: InternError = null;
		if (this.error) {
			error = {
				name: this.error.name,
				message: this.error.message,
				stack: this.error.stack,
				showDiff: !!this.error.showDiff
			};

			if (this.error.showDiff) {
				error.actual = this.error.actual;
				error.expected = this.error.expected;
			}
		}

		return {
			error: error,
			id: this.id,
			name: this.name,
			sessionId: this.sessionId,
			timeElapsed: this.timeElapsed,
			timeout: this.timeout,
			hasPassed: this.hasPassed,
			skipped: this.skipped
		};
	}
}
