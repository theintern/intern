import Task, { isThenable } from '@dojo/core/async/Task';
import Deferred from './Deferred';
import Executor from './executors/Executor';
import Test, { isTest, SKIP } from './Test';
import { InternError } from './types';
import { Remote } from './executors/WebDriver';
import Promise from '@dojo/shim/Promise';

export default class Suite implements SuiteProperties {
	after: SuiteLifecycleFunction;

	afterEach: TestLifecycleFunction;

	async: (timeout?: number) => Deferred<void>;

	before: SuiteLifecycleFunction;

	beforeEach: TestLifecycleFunction;

	error: InternError;

	name: string;

	parent: Suite;

	/**
	 * If true, the suite will publish its start topic after the before callback has finished,
	 * and will publish its end topic before the after callback has finished.
	 */
	publishAfterSetup = false;

	skipped: string;

	tests: (Suite | Test)[];

	timeElapsed: number;

	private _bail: boolean;

	private _executor: Executor;

	private _grep: RegExp;

	private _remote: Remote;

	private _sessionId: string;

	private _timeout: number;

	constructor(options: SuiteOptions | RootSuiteOptions) {
		if (!options.name && !options.executor) {
			throw new Error('A Suite requires a name or executor');
		}

		Object.keys(options).filter(key => {
			return key !== 'tests';
		}).forEach((key: keyof SuiteOptions) => {
			this[key] = options[key];
		});

		this.tests = [];

		if (options.tests) {
			options.tests.forEach(suiteOrTest => this.add(suiteOrTest));
		}
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
	 * The executor used to run this Suite.
	 */
	get executor(): Executor {
		return this._executor || (this.parent && this.parent.executor);
	}

	set executor(value: Executor) {
		if (this._executor) {
			throw new Error('AlreadyAssigned: an executor may only be set once per suite');
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
	 * The unique identifier of the suite's parent.
	 */
	get parentId() {
		const parent = this.parent;
		if (parent) {
			return parent.id;
		}
	}

	/**
	 * The WebDriver interface for driving a remote environment. This value is only guaranteed to exist from the
	 * before/beforeEach/afterEach/after and test methods, since environments are not instantiated until they are
	 * actually ready to be tested against.
	 */
	get remote() {
		return (this.parent && this.parent.remote) ? this.parent.remote : this._remote;
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
		const parent = this.parent;
		if (parent) {
			return parent.sessionId;
		}
		if (this._sessionId) {
			return this._sessionId;
		}
		if (this.remote) {
			return this.remote.session.sessionId;
		}
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
	get numTests(): number {
		return this.tests.reduce((numTests, suiteOrTest) => {
			if (isSuite(suiteOrTest)) {
				return numTests + suiteOrTest.numTests;
			}
			return numTests + 1;
		}, 0);
	}

	/**
	 * The total number of tests in this test suite and any sub-suites that have failed.
	 */
	get numFailedTests(): number {
		return this.tests.reduce((numFailedTests, suiteOrTest) => {
			if (isSuite(suiteOrTest)) {
				return numFailedTests + suiteOrTest.numFailedTests;
			}
			else if (suiteOrTest.error) {
				return numFailedTests + 1;
			}
			return numFailedTests;
		}, 0);
	}

	/**
	 * The total number of tests in this test suite and any sub-suites that were skipped.
	 */
	get numSkippedTests(): number {
		return this.tests.reduce((numSkippedTests, suiteOrTest) => {
			if (isSuite(suiteOrTest)) {
				return numSkippedTests + suiteOrTest.numSkippedTests;
			}
			else if (suiteOrTest.skipped) {
				return numSkippedTests + 1;
			}
			return numSkippedTests;
		}, 0);
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

		suiteOrTest.parent = this;
		this.tests.push(suiteOrTest);
	}

	/**
	 * Runs test suite in order:
	 *
	 * * before
	 * * <for each test>
	 *   * beforeEach
	 *   * test
	 *   * afterEach
	 * * after
	 *
	 * If before, beforeEach, afterEach, or after throw, the suite itself will be marked as failed
	 * and no further tests in the suite will be executed.
	 */
	run(): Task<any> {
		let startTime: number;

		const end = () => {
			this.timeElapsed = Date.now() - startTime;
			return this.executor.emit('suiteEnd', this);
		};

		const runLifecycleMethod = (suite: Suite, name: string, ...args: any[]) => {
			return new Task(resolve => {
				let dfd: Deferred<any>;
				let timeout: number;

				// Provide a new Suite#async method for each call of a lifecycle method since there's no concept of
				// a Suite-wide async deferred as there is for Tests.
				suite.async = function (_timeout) {
					timeout = _timeout;

					dfd = new Deferred();

					suite.async = function () {
						return dfd;
					};

					return dfd;
				};

				const suiteFunc: () => Promise<any> = (<any>suite)[name];
				let returnValue = suiteFunc && suiteFunc.call(suite, test);

				if (dfd) {
					// If a timeout was set, async was called, so we should use the dfd created by the call to
					// manage the timeout.
					if (timeout) {
						let timer = setTimeout(function () {
							dfd.reject(new Error('Timeout reached on ' + suite.id + '#' + name));
						}, timeout);

						dfd.promise.catch(_error => {}).then(() => timer && clearTimeout(timer));
					}

					// If the return value looks like a promise, resolve the dfd if the return value resolves
					if (isThenable(returnValue)) {
						returnValue.then((value: any) => dfd.resolve(value), error => dfd.reject(error));
					}

					returnValue = dfd.promise;
				}

				resolve(returnValue);
			}).catch((error: InternError) => {
				// Remove the async method since it should only be available within a lifecycle function call
				suite.async = undefined;

				if (error !== SKIP) {
					if (!this.error) {
						this.error = error;
					}
					throw error;
				}
			});
		};

		const start = () => {
			return this.executor.emit('suiteStart', this).then(function () {
				startTime = Date.now();
			});
		};

		const before = () => {
			return runLifecycleMethod(this, 'before');
		};

		const after = () => {
			return runLifecycleMethod(this, 'after');
		};

		// Reset some state in case someone tries to re-run the same suite
		// TODO: Cancel any previous outstanding suite run
		// TODO: Test
		this.error = null;
		this.timeElapsed = null;

		let task: Task<any>;

		try {
			task = this.publishAfterSetup ? before().then(start) : start().then(before);
		}
		catch (error) {
			return Task.reject(error);
		}

		return task.then(() => {
			let i = 0;
			let tests = this.tests;
			let current: Task<any>;

			const runTestLifecycle = (name: string, test: Test) => {
				// beforeEach executes in order parent -> child;
				// afterEach executes in order child -> parent
				const orderMethod: ('push' | 'unshift') = name === 'beforeEach' ? 'push' : 'unshift';

				// LIFO queue
				let suiteQueue: Suite[] = [];
				let suite: Suite = this;

				do {
					(<any>suiteQueue)[orderMethod](suite);
				}
				while ((suite = suite.parent));

				let current: Task<any>;

				return new Task(
					(resolve, reject) => {
						let firstError: Error;

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

							current = runLifecycleMethod(suite, name, test).then(next, handleError);
						}

						next();
					},
					() => {
						suiteQueue.splice(0, suiteQueue.length);
						if (current) {
							current.cancel();
						}
					}
				);
			};

			return new Task(
				(resolve, reject) => {
					let firstError: Error;

					const next = () => {
						const test = tests[i++];

						// The task is over when there are no more tests to run
						if (!test) {
							firstError ? reject(firstError) : resolve();
							return;
						}

						const handleError = (error: InternError) => {
							// An error may be associated with a deeper test already, in which case we do not
							// want to reassociate it with a more generic parent
							if (!error.relatedTest) {
								error.relatedTest = <Test>test;
							}
						};

						function runWithCatch() {
							// Errors raised when running child tests should be reported but should not cause
							// this suite’s run to reject, since this suite itself has not failed.
							return test.run().catch(error => {
								handleError(error);
							});
						}

						// If the suite will be skipped, mark the current test as skipped. This will skip both
						// individual tests and nested suites.
						if (this.skipped != null) {
							test.skipped = this.skipped;
						}

						// test is a suite
						if (isSuite(test)) {
							current = runWithCatch();
						}
						// test is a single test
						else {
							if (!this.grep.test(test.id)) {
								test.skipped = 'grep';
							}

							if (test.skipped != null) {
								current = this.executor.emit('testEnd', <Test>test);
							}
							else {
								current = runTestLifecycle('beforeEach', test)
									.then(runWithCatch)
									.finally(() => runTestLifecycle('afterEach', test))
									.catch(error => {
										firstError = firstError || error;
										return handleError(error);
									});
							}
						}

						current.then(() => {
							const skipRestOfSuite = () => {
								this.skipped = this.skipped != null ? this.skipped : BAIL_REASON;
							};

							// If the test was a suite and the suite was skipped due to bailing, skip the rest of this
							// suite
							if (isSuite(test) && test.skipped === BAIL_REASON) {
								skipRestOfSuite();
							}
							// If the test errored and bail mode is enabled, skip the rest of this suite
							else if (test.error && this.bail) {
								skipRestOfSuite();
							}

							next();
						});
					};

					next();
				},
				() => {
					i = Infinity;
					if (current) {
						current.cancel();
					}
				}
			);
		}).finally(() => this.publishAfterSetup ? end().then(after) : after().then(end));
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
		throw SKIP;
	}

	toJSON(): Object {
		return {
			name: this.name,
			id: this.id,
			parentId: this.parentId,
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
				// relatedTest can be the Suite itself in the case of nested suites (a nested Suite's error is
				// caught by a parent Suite, which assigns the nested Suite as the relatedTest, resulting in
				// nestedSuite.relatedTest === nestedSuite); in that case, don't serialize it
				relatedTest: this.error.relatedTest === <any>this ? undefined : this.error.relatedTest
			} : null
		};
	}
}

export function isSuite(value: any): value is Suite {
	return value.name && value.tests && typeof value.numTests === 'number' && typeof value.hasParent === 'boolean';
}

export function isSuiteOptions(value: any): value is SuiteOptions {
	return !(value instanceof Suite) && value.name && value.tests && (
		value.before != null ||
		value.beforeEach != null ||
		value.after != null ||
		value.afterEach != null
	);
}

export interface SuiteLifecycleFunction {
	(this: Suite): void | Promise<any>;
}

export interface TestLifecycleFunction {
	(this: Suite, test: Test): void | Promise<any>;
}

// Properties that define a Suite. Note that 'tests' isn't included so that other interfaces, such as the object
// interface, can use a different definition for it.
export interface SuiteProperties {
	after: SuiteLifecycleFunction;
	afterEach: TestLifecycleFunction;
	bail: boolean;
	before: SuiteLifecycleFunction;
	beforeEach: TestLifecycleFunction;
	executor: Executor;
	grep: RegExp;
	name: string;
	parent: Suite;
	publishAfterSetup: boolean;
	timeout: number;
}

export type SuiteOptions = Partial<SuiteProperties> & {
	name: string;
	tests?: (Suite | Test)[];
};

export type RootSuiteOptions = Partial<SuiteProperties> & {
	executor: Executor;
	tests?: (Suite | Test)[];
};

// BAIL_REASON needs to be a string so that Intern can tell when a remote has bailed during unit tests so that it can
// skip functional tests.
const BAIL_REASON = 'bailed';
