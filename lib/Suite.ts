import Command = require('leadfoot/Command');
import Promise = require('dojo/Promise');
import ReporterManager from './ReporterManager';
import Test from './Test';
import { StackError } from './util';

interface TestRelatedError extends StackError {
	relatedTest?: Suite | Test;
}

type MaybePromise = void | Promise.Thenable<void>;

export default class Suite {
	afterEach: (test: Test) => MaybePromise;
	beforeEach: (test: Test) => MaybePromise;
	name: string;
	error: Error;
	parent: Suite;
	/**
	 * If true, the suite will only publish its start topic after the setup callback has finished,
	 * and will publish its end topic before the teardown callback has finished.
	 */
	publishAfterSetup: boolean = false;
	setup: () => MaybePromise;
	teardown: () => MaybePromise;
	tests: Array<Suite | Test> = [];
	timeElapsed: number;

	private _grep: RegExp;
	/**
	 * A regular expression used to filter, by test ID, which tests are run.
	 */
	get grep(): RegExp {
		return this._grep || (this.parent && this.parent.grep) || /.*/;
	}

	set grep(value: RegExp) {
		this._grep = value;
	}

	/**
	 * Whether or not this suite has a parent (for parity with serialized Suites).
	 */
	get hasParent() {
		return Boolean(this.parent);
	}

	/**
	 * The unique identifier of the suite, assuming all combinations of suite + test are unique.
	 */
	get id() {
		const name: string[] = [];
		let object = this;

		do {
			object.name != null && name.unshift(object.name);
		} while ((object = object.parent));

		return name.join(' - ');
	}

	/**
	 * The total number of tests in this test suite and any sub-suites that have failed.
	 */
	get numFailedTests() {
		function reduce(numFailedTests: number, test: Suite | Test): number {
			return (<Suite> test).tests ?
				(<Suite> test).tests.reduce(reduce, numFailedTests) :
				((<Test> test).hasPassed || (<Test> test).skipped != null ? numFailedTests : numFailedTests + 1);
		}

		return this.tests.reduce(reduce, 0);
	}

	/**
	 * The total number of tests in this test suite and any sub-suites that were skipped.
	 */
	get numSkippedTests() {
		function reduce(numSkippedTests: number, test: Suite | Test): number {
			return (<Suite> test).tests ?
				(<Suite> test).tests.reduce(reduce, numSkippedTests) :
				((<Test> test).skipped != null ? numSkippedTests + 1 : numSkippedTests);
		}

		return this.tests.reduce(reduce, 0);
	}

	/**
	 * The total number of tests in this suite and any sub-suites. To get only the number of tests for this suite,
	 * look at `this.tests.length`.
	 */
	get numTests() {
		function reduce(numTests: number, test: Suite | Test): number {
			return (<Suite> test).tests ? (<Suite> test).tests.reduce(reduce, numTests) : numTests + 1;
		}

		return this.tests.reduce(reduce, 0);
	}

	private _remote: Command<any>;
	/**
	 * The WebDriver interface for driving a remote environment. This value is only guaranteed to exist from the
	 * setup/beforeEach/afterEach/teardown and test methods, since environments are not instantiated until they are
	 * actually ready to be tested against.
	 */
	get remote(): Command<any> {
		return (this.parent && this.parent.remote) ? this.parent.remote : this._remote;
	}

	set remote(value) {
		if (this._remote) {
			throw new Error('remote may only be set once per suite');
		}

		Object.defineProperty(this, '_remote', { value: value });
	}

	private _reporterManager: ReporterManager;
	/**
	 * The reporter manager that should receive lifecycle events from the Suite.
	 */
	get reporterManager(): ReporterManager {
		return this._reporterManager || (this.parent && this.parent.reporterManager);
	}

	set reporterManager(value) {
		if (this._reporterManager) {
			throw new Error('reporterManager may only be set once per suite');
		}

		Object.defineProperty(this, '_reporterManager', { value: value });
	}

	private _sessionId: string;
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
	set sessionId(value) {
		Object.defineProperty(this, '_sessionId', { value: value });
	}

	private _timeout: number;
	/**
	 * The default timeout for all tests in the suite.
	 */
	get timeout(): number {
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

	constructor(kwArgs: KwArgs) {
		for (let k in kwArgs) {
			(<any> this)[k] = (<any> kwArgs)[k];
		}

		if (this.reporterManager) {
			this.reporterManager.emit('newSuite', this);
		}
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
	 */
	run() {
		const reporterManager = this.reporterManager;
		const self = this;
		let startTime: number;

		function end() {
			self.timeElapsed = Date.now() - startTime;
			return report('suiteEnd');
		}

		function report(eventName: 'suiteError', error: Error): Promise<void>;
		function report(eventName: string, ...args: any[]): Promise<void>;
		function report(eventName: string) {
			if (reporterManager) {
				const args = [ eventName, self ].concat(Array.prototype.slice.call(arguments, 1));
				return reporterManager.emit.apply(reporterManager, args);
			}
			else {
				return Promise.resolve(null);
			}
		}

		function reportSuiteError(error: Error) {
			self.error = error;
			return report('suiteError', error).then(function () {
				throw error;
			});
		}

		function runTestLifecycle(name: string, test: Test) {
			// LIFO queue
			const suiteQueue: Suite[] = [];
			let suite = self;

			// beforeEach executes in order parent -> child;
			// afterEach executes in order child -> parent
			if (name === 'beforeEach') {
				do {
					suiteQueue.push(suite);
				}
				while ((suite = suite.parent));
			}
			else {
				do {
					suiteQueue.unshift(suite);
				}
				while ((suite = suite.parent));
			}

			return new Promise<void>(function (resolve, reject, progress, setCanceler) {
				let current: Promise<void>;
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
						return new Promise(function (resolve) {
							resolve((<any> suite)[name] && (<any> suite)[name](test));
						}).catch(reportSuiteError);
					}

					current = runWithCatch().then(next, handleError);
				}

				next();
			});
		}

		function runTests() {
			let i = 0;
			const tests = self.tests;

			return new Promise<void>(function (resolve, reject, progress, setCanceler) {
				let current: Promise<void>;
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

					function reportAndContinue(error: TestRelatedError) {
						// An error may be associated with a deeper test already, in which case we do not
						// want to reassociate it with a more generic parent
						if (!error.relatedTest) {
							error.relatedTest = test;
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

					if ((<Suite> test).tests) {
						current = runWithCatch();
					}
					else {
						if (!self.grep.test(test.id)) {
							(<Test> test).skipped = 'grep';
							reporterManager.emit('testSkip', test).then(next);
							return;
						}

						current = runTestLifecycle('beforeEach', <Test> test)
							.then(runWithCatch)
							.finally(function () {
								return runTestLifecycle('afterEach', <Test> test);
							})
							.catch(function (error: Error) {
								firstError = firstError || error;
								return reportAndContinue(<TestRelatedError> error);
							});
					}

					current.then(next);
				}

				next();
			});
		}

		function setup() {
			return new Promise<void>(function (resolve) {
				resolve(self.setup && self.setup());
			}).catch(reportSuiteError);
		}

		function start() {
			return report('suiteStart').then(function () {
				startTime = Date.now();
			});
		}

		function teardown() {
			return new Promise<void>(function (resolve) {
				resolve(self.teardown && self.teardown());
			}).catch(reportSuiteError);
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

	toJSON() {
		return {
			name: this.name,
			id: this.id,
			sessionId: this.sessionId,
			hasParent: Boolean(this.parent),
			// `Test` only isn’t right, but the compiler cannot deal with creating the correct
			// return type for `toJSON` automatically if it references `Suite`, and it is not worth
			// manually creating the return type.
			tests: this.tests.map(function (test: Test) {
				return test.toJSON();
			}),
			timeElapsed: this.timeElapsed,
			numTests: this.numTests,
			numFailedTests: this.numFailedTests,
			numSkippedTests: this.numSkippedTests,
			error: this.error ? {
				name: this.error.name,
				message: this.error.message,
				stack: (<TestRelatedError> this.error).stack,
				relatedTest: (<TestRelatedError> this.error).relatedTest
			} : null
		};
	}
}

export interface KwArgs {
	afterEach?: (test: Test) => MaybePromise;
	beforeEach?: (test: Test) => MaybePromise;
	grep?: RegExp;
	name?: string;
	parent?: Suite;
	publishAfterSetup?: boolean;
	remote?: Command<void>;
	reporterManager?: ReporterManager;
	sessionId?: string;
	setup?: () => MaybePromise;
	teardown?: () => MaybePromise;
	tests?: Array<Suite | Test>;
	timeout?: number;
}
