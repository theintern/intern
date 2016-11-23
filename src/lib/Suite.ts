import * as Promise from 'dojo/Promise';

import { Test, TestFunction } from './Test';
import { InternError, Remote } from '../interfaces';
import * as util from './util';

// BAIL_REASON needs to be a string so that Intern can tell when a remote has bailed during unit tests so that it
// can skip functional tests.
const BAIL_REASON = 'bailed';

export interface SuiteLifecycleFunction {
	(): void | Promise<any>;
}

export interface TestLifecycleFunction {
	(test: Test): void | Promise<any>;
}

export interface SuiteConfig {
	after?: SuiteLifecycleFunction;
	afterEach?: TestLifecycleFunction;
	before?: SuiteLifecycleFunction;
	beforeEach?: TestLifecycleFunction;
	name?: string;
	parent?: Suite;
	setup?: SuiteLifecycleFunction;
	teardown?: SuiteLifecycleFunction;
	timeout?: number;
	[name: string]: any;
}

export class Suite {
	async: (timeout?: number) => Promise.Deferred<void>;

	afterEach: TestLifecycleFunction = null;

	beforeEach: TestLifecycleFunction = null;

	error: InternError;

	name: string;

	parent: Suite;

	setup: SuiteLifecycleFunction;

	skipped: string;

	teardown: SuiteLifecycleFunction;

	tests: (Suite | Test)[];

	timeElapsed: number;

	/**
	 * If true, the suite will only publish its start topic after the setup callback has finished,
	 * and will publish its end topic before the teardown callback has finished.
	 */
	publishAfterSetup: boolean = false;

	private _bail: boolean;

	private _grep: RegExp;

	private _remote: Remote;

	private _environmentType: any;

	private _reporterManager: any;

	private _sessionId: string;

	private _timeout: number;

	constructor(config: SuiteConfig)  {
		this.tests = [];

		const anyThis = <any> this;
		for (let k in config) {
			anyThis[k] = config[k];
		}

		this.reporterManager && this.reporterManager.emit('newSuite', this);
	}

	/**
	 * A flag used to indicate whether a test run shoudl stop after a failed test.
	 */
	get bail() {
		return this._bail || (this.parent && this.parent.bail);
	}

	set bail(value: boolean) {
		this._bail = value;
	}

	/**
	 * A regular expression used to filter, by test ID, which tests are run.
	 */
	get grep() {
		return this._grep || (this.parent && this.parent.grep) || /.*/;
	}

	set grep(value: RegExp) {
		this._grep = value;
	}

	/**
	 * The unique identifier of the suite, assuming all combinations of suite + test are unique.
	 */
	get id() {
		let name: string[] = [];
		let object: Suite = this;

		do {
			object.name != null && name.unshift(object.name);
		} while ((object = object.parent));

		return name.join(' - ');
	}

	/**
	 * The WebDriver interface for driving a remote environment. This value is only guaranteed to exist from the
	 * setup/beforeEach/afterEach/teardown and test methods, since environments are not instantiated until they are
	 * actually ready to be tested against.
	 */
	get remote() {
		return (this.parent && this.parent.remote) ? this.parent.remote : this._remote;
	}

	set remote(value: Remote) {
		if (this._remote) {
			throw new Error('remote may only be set once per suite');
		}

		this._remote = value;
	}

	/**
	 * The reporter manager that should receive lifecycle events from the Suite.
	 */
	get reporterManager(): any {
		return this._reporterManager || (this.parent && this.parent.reporterManager);
	}

	set reporterManager(value: any) {
		if (this._reporterManager) {
			throw new Error('reporterManager may only be set once per suite');
		}

		this._reporterManager = value;
	}

	/**
	 * The sessionId of the environment in which the suite executed.
	 */
	get sessionId(): string {
		return this.parent ? this.parent.sessionId :
			this._sessionId ? this._sessionId :
			this.remote ? this.remote.session.sessionId :
			null;
	}

	/**
	 * The sessionId may need to be overridden for suites proxied from client.js.
	 */
	set sessionId(value: string) {
		this._sessionId = value;
	}

	/**
	 * The total number of tests in this suite and any sub-suites. To get only the number of tests for this suite,
	 * look at `this.tests.length`.
	 */
	get numTests() {
		function reduce(numTests: number, test: Suite): number {
			return test.tests ? test.tests.reduce(reduce, numTests) : numTests + 1;
		}

		return this.tests.reduce(reduce, 0);
	}

	/**
	 * The total number of tests in this test suite and any sub-suites that have failed.
	 */
	get numFailedTests() {
		function reduce(numFailedTests: number, test: (Suite|Test)): number {
			return (<Suite> test).tests ?
				(<Suite> test).tests.reduce(reduce, numFailedTests) :
				((<Test> test).hasPassed || test.skipped != null ? numFailedTests : numFailedTests + 1);
		}

		return this.tests.reduce(reduce, 0);
	}

	/**
	 * The total number of tests in this test suite and any sub-suites that were skipped.
	 */
	get numSkippedTests() {
		function reduce(numSkippedTests: number, test: (Suite|Test)): number {
			return (<Suite> test).tests ?
				(<Suite> test).tests.reduce(reduce, numSkippedTests) :
				(test.skipped != null ? numSkippedTests + 1 : numSkippedTests);
		}

		return this.tests.reduce(reduce, 0);
	}

	/**
	 * Whether or not this suite has a parent (for parity with serialized Suites).
	 */
	get hasParent() {
		return Boolean(this.parent);
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

	set timeout(value: number) {
		this._timeout = value;
	}

	/**
	 * Runs test suite in order:
	 *
	 * * setup
	 * * for each test:
	 *   * beforeEach
	 *   * test
	 *   * afterEach
	 * * teardown
	 *
	 * If setup, beforeEach, afterEach, or teardown throw, the suite itself will be marked as failed
	 * and no further tests in the suite will be executed.
	 *
	 * @returns {module:dojo/Promise}
	 */
	run(): Promise<any> {
		const reporterManager = this.reporterManager;
		const self = this;
		let startTime: number;

		function runLifecycleMethod(suite: Suite, name: string, ...args: any[]) {
			return new Promise(function (resolve) {
				let dfd: Promise.Deferred<any>;
				let timeout: number;

				// Provide a new Suite#async method for each call of a lifecycle method since there's no concept of
				// a Suite-wide async deferred as there is for Tests.
				suite.async = function (_timeout) {
					timeout = _timeout;

					dfd = util.createDeferred();

					suite.async = function () {
						return dfd;
					};

					return dfd;
				};

				const suiteFunc: () => Promise<any> = (<any> suite)[name];
				let returnValue = suiteFunc && suiteFunc.apply(suite, args);

				if (dfd) {
					// If a timeout was set, async was called, so we should use the dfd created by the call to
					// manage the timeout.
					if (timeout) {
						var timer = setTimeout(function () {
							dfd.reject(new Error('Timeout reached on ' + suite.id + '#' + name));
						}, timeout);

						dfd.promise.finally(function () {
							timer && clearTimeout(timer);
						});
					}

					// If the return value looks like a promise, resolve the dfd if the return value resolves
					if (returnValue && returnValue.then) {
						returnValue.then(
							function (value: any) {
								dfd.resolve(value);
							},
							function (error: Error) {
								dfd.reject(error);
							}
						);
					}

					returnValue = dfd.promise;
				}

				resolve(returnValue);
			}).catch(function (error: InternError) {
				// Remove the async method since it should only be available within a lifecycle function call
				suite.async = undefined;

				if (error !== Test.SKIP) {
					return reportSuiteError(error);
				}
			});
		}

		function end() {
			self.timeElapsed = Date.now() - startTime;
			return report('suiteEnd');
		}

		function report(eventName: string, ...args: any[]) {
			if (reporterManager) {
				const args = [ eventName, self ].concat(Array.prototype.slice.call(arguments, 1));
				return reporterManager.emit.apply(reporterManager, args);
			}
			else {
				return Promise.resolve();
			}
		}

		function reportSuiteError(error: InternError) {
			self.error = error;
			return report('suiteError', error).then(function () {
				throw error;
			});
		}

		function runTestLifecycle(name: string, test: Test) {
			// beforeEach executes in order parent -> child;
			// afterEach executes in order child -> parent
			const orderMethod: ('push' | 'unshift') = name === 'beforeEach' ? 'push' : 'unshift';

			// LIFO queue
			let suiteQueue: Suite[] = [];
			let suite: Suite = self;

			do {
				(<any> suiteQueue)[orderMethod](suite);
			}
			while ((suite = suite.parent));

			return new Promise(function (resolve, reject, progress, setCanceler) {
				let current: Promise<any>;
				let firstError: Error;

				setCanceler(function (reason) {
					suiteQueue.splice(0, suiteQueue.length);
					if (current) {
						current.cancel(reason);
						// Wait for the current lifecycle to finish, then reject
						return current.finally(function () {
							throw reason;
						});
					}
					throw reason;
				});

				function handleError(error: Error) {
					if (name === 'afterEach') {
						firstError = firstError || error;
						next();
					}
					else {
						reject(error);
					}
				}

				function next() {
					const suite = suiteQueue.pop();

					if (!suite) {
						firstError ? reject(firstError) : resolve();
						return;
					}

					function runWithCatch() {
						return runLifecycleMethod(suite, name, test);
					}

					current = runWithCatch().then(next, handleError);
				}

				next();
			});
		}

		function runTests() {
			let i = 0;
			let tests = self.tests;

			return new Promise(function (resolve, reject, progress, setCanceler) {
				let current: Promise<any>;
				let firstError: Error;

				setCanceler(function (reason) {
					i = Infinity;
					if (current) {
						current.cancel(reason);
						// Wait for the current test to finish, then reject
						return current.finally(function () {
							throw reason;
						});
					}
					throw reason;
				});

				function next() {
					const test = tests[i++];

					if (!test) {
						firstError ? reject(firstError) : resolve();
						return;
					}

					function reportAndContinue(error: InternError) {
						// An error may be associated with a deeper test already, in which case we do not
						// want to reassociate it with a more generic parent
						if (!error.relatedTest) {
							error.relatedTest = <Test> test;
						}
					}

					function runWithCatch() {
						// Errors raised when running child tests should be reported but should not cause
						// this suite’s run to reject, since this suite itself has not failed.
						try {
							return test.run().catch(reportAndContinue);
						}
						catch (error) {
							return reportAndContinue(error);
						}
					}

					// If the suite will be skipped, mark the current test as skipped. This will skip both
					// individual tests and nested suites.
					if (self.skipped != null) {
						test.skipped = self.skipped;
					}

					// test is a suite
					if ((<Suite> test).tests) {
						current = runWithCatch();
					}
					// test is a single test
					else {
						if (!self.grep.test(test.id)) {
							test.skipped = 'grep';
						}

						if (test.skipped != null) {
							reporterManager.emit('testSkip', test).then(next);
							return;
						}

						current = runTestLifecycle('beforeEach', <Test> test)
							.then(runWithCatch)
							.finally(function () {
								return runTestLifecycle('afterEach', <Test> test);
							})
							.catch(function (error: InternError) {
								firstError = firstError || error;
								return reportAndContinue(error);
							});
					}

					current.then(function () {
						function skipRestOfSuite() {
							self.skipped = self.skipped != null ? self.skipped : BAIL_REASON;
						}

						// If the test was a suite and the suite was skipped due to bailing, skip the rest of this
						// suite
						if ((<Suite> test).tests && test.skipped === BAIL_REASON) {
							skipRestOfSuite();
						}
						// If the test errored and bail mode is enabled, skip the rest of this suite
						else if (test.error && self.bail) {
							skipRestOfSuite();
						}

						next();
					});
				}

				next();
			});
		}

		function setup() {
			return runLifecycleMethod(self, 'setup');
		}

		function start() {
			return report('suiteStart').then(function () {
				startTime = Date.now();
			});
		}

		function teardown() {
			return runLifecycleMethod(self, 'teardown');
		}

		// Reset some state in case someone tries to re-run the same suite
		// TODO: Cancel any previous outstanding suite run
		// TODO: Test
		this.error = this.timeElapsed = null;

		return (function () {
			if (!self.publishAfterSetup) {
				return start().then(setup);
			}
			else {
				return setup().then(start);
			}
		})()
		.then(runTests)
		.finally(function () {
			if (self.publishAfterSetup) {
				return end().then(teardown);
			}
			else {
				return teardown().then(end);
			}
		})
		.then(function () {
			return self.numFailedTests;
		});
	}

	/**
	 * Skips this suite.
	 *
	 * @param {String} message
	 * If provided, will be stored in this suite's `skipped` property.
	 */
	skip(message: string = 'suite skipped') {
		this.skipped = message;
		// Use the SKIP constant from Test so that calling Suite#skip from a test won't fail the test.
		throw Test.SKIP;
	}

	toJSON(): Object {
		return {
			name: this.name,
			id: this.id,
			sessionId: this.sessionId,
			hasParent: Boolean(this.parent),
			tests: this.tests.map(function (test) {
				return test.toJSON();
			}),
			timeElapsed: this.timeElapsed,
			numTests: this.numTests,
			numFailedTests: this.numFailedTests,
			numSkippedTests: this.numSkippedTests,
			skipped: this.skipped,
			error: this.error ? {
				name: this.error.name,
				message: this.error.message,
				stack: this.error.stack,
				relatedTest: this.error.relatedTest
			} : null
		};
	}
}
