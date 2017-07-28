import { after } from '@dojo/core/aspect';
import { create } from '@dojo/core/lang';
import Promise from '@dojo/shim/Promise';
import Suite from '../Suite';
import Test from '../Test';
import Executor from '../../lib/executors/Executor';
import { assert, AssertionError } from 'chai';
import { Handle } from '@dojo/interfaces/core';

export interface QUnitBeginData {
	totalTests: number;
}

export interface QUnitDoneData {
	failed: number;
	passed: number;
	runtime: number;
	total: number;
}

export interface QUnitLogData {
	result: boolean;
	actual: any | undefined;
	expected: any | undefined;
	message: any | undefined;
	source: any | undefined;
	module: string;
	name: string;
}

export interface QUnitModuleDoneData extends QUnitDoneData {
	name: string;
}

export interface QUnitModuleStartData {
	name: string;
}

export interface QUnitTestDoneData extends QUnitModuleDoneData {
	module: string;
}

export interface QUnitTestStartData extends QUnitModuleStartData {
	module: string;
}

export type QUnitCallback<T> = (data: T) => void;

export interface QUnitInterface {
	assert: QUnitBaseAssert;
	config: QUnitConfig;
	extend<T extends {}, U extends {}>(target: T, mixin: U, skipExistingTargetProperties: boolean): T & U;
	start(): void;
	stop(): void;

	asyncTest(name: string, test: QUnitTestFunction): void;
	module(name: string, lifecycle?: QUnitHooks): void;
	test(name: string, test?: QUnitTestFunction): void;

	begin(callback: QUnitCallback<QUnitBeginData>): void;
	done(callback: QUnitCallback<QUnitDoneData>): void;
	log(callback: QUnitCallback<QUnitLogData>): void;
	moduleDone(callback: QUnitCallback<QUnitModuleDoneData>): void;
	moduleStart(callback: QUnitCallback<QUnitModuleStartData>): void;
	testDone(callback: QUnitCallback<QUnitTestDoneData>): void;
	testStart(callback: QUnitCallback<QUnitTestStartData>): void;
}

export function getInterface(executor: Executor) {
	let autostartHandle: Handle | undefined;

	const baseAssert: QUnitBaseAssert = {
		_expectedAssertions: NaN,

		_numAssertions: 0,

		deepEqual: wrapChai('deepEqual'),

		equal: wrapChai('equal'),

		expect: function (numTotal?: number) {
			if (arguments.length === 1) {
				this._expectedAssertions = numTotal!;
			}
			else {
				return this._expectedAssertions;
			}
		},

		notDeepEqual: wrapChai('notDeepEqual'),

		notEqual: wrapChai('notEqual'),

		notPropEqual: wrapChai('notDeepEqual'),

		notStrictEqual: wrapChai('notStrictEqual'),

		ok: wrapChai('ok'),

		push: function (this: QUnitBaseAssert, ok: any, actual: any, expected: any, message?: string): void {
			++this._numAssertions;
			if (!ok) {
				assert.fail(actual, expected, message);
			}
		},

		propEqual: wrapChai('propEqual'),

		strictEqual: wrapChai('strictEqual'),

		throws: (function () {
			const throws = wrapChai('throws');
			return function (this: QUnitBaseAssert, fn: Function, expected: Object | RegExp | Error, message?: string) {
				if (typeof expected === 'function') {
					++this._numAssertions;
					try {
						fn();
						throw new AssertionError(`${message ? message + ': ' : ''}expected [Function] to throw`);
					}
					catch (error) {
						if (!expected(error)) {
							throw new AssertionError(
								(message ? message + ': ' : '') +
								'expected [Function] to throw error matching [Function] but got ' +
								(error instanceof Error ? error.toString() : error)
							);
						}
					}
				}
				else {
					throws.apply(this, arguments);
				}
			};
		})(),

		raises: function (this: QUnitBaseAssert) {
			return this.throws.apply(this, arguments);
		},

		verifyAssertions: function (this: QUnitBaseAssert) {
			if (isNaN(this._expectedAssertions) && QUnit.config.requireExpects) {
				throw new AssertionError('Expected number of assertions to be defined, but expect() was ' +
					'not called.');
			}

			if (!isNaN(this._expectedAssertions) && this._numAssertions !== this._expectedAssertions) {
				throw new AssertionError('Expected ' + this._expectedAssertions + ' assertions, but ' +
					this._numAssertions + ' were run');
			}
		}
	};

	const QUnit: QUnitInterface = {
		assert: baseAssert,

		config: <QUnitConfig>{
			get autostart() {
				return !autostartHandle;
			},

			set autostart(value) {
				if (autostartHandle) {
					autostartHandle.destroy();
					autostartHandle = undefined;
				}

				if (!value) {
					autostartHandle = executor.on('beforeRun', () => {
						return new Promise<void>(resolve => {
							QUnit.start = resolve;
						});
					});

					QUnit.start = () => {
						autostartHandle!.destroy();
						autostartHandle = undefined;
						QUnit.start = () => {};
					};
				}
			},

			_module: <string><any>undefined,

			get module(this: QUnitConfig) {
				return this._module;
			},

			set module(this: QUnitConfig, value: string) {

				this._module = value;
				executor.addSuite(suite => {
					suite.grep = new RegExp('(?:^|[^-]* - )' + escapeRegExp(value) + ' - ', 'i');
				});
			},

			requireExpects: false,

			testTimeout: Infinity
		},

		extend<T extends {}, U extends {}>(target: T, mixin: U, skipExistingTargetProperties: boolean = false): T & U {
			const result: T & U = target as any;
			for (let key in mixin) {
				if (mixin.hasOwnProperty(key)) {
					if (mixin[key] === undefined) {
						delete result[key];
					}
					else if (!skipExistingTargetProperties || result[key] === undefined) {
						result[key] = mixin[key];
					}
				}
			}
			return result;
		},

		start() {},

		stop() {},

		// test registration
		asyncTest(name: string, test: QUnitTestFunction) {
			registerTest(name, function (this: QUnitTest) {
				this.timeout = QUnit.config.testTimeout;

				let numCallsUntilResolution = 1;
				const dfd = this.async();
				const testAssert = create(baseAssert, { _expectedAssertions: NaN, _numAssertions: 0 });

				QUnit.stop = function () {
					++numCallsUntilResolution;
				};
				QUnit.start = <() => void> dfd.rejectOnError(function () {
					if (--numCallsUntilResolution === 0) {
						try {
							testAssert.verifyAssertions();
							dfd.resolve();
						}
						finally {
							QUnit.stop = QUnit.start = function () {};
						}
					}
				});

				try {
					test.call(this.parent._qunitContext, testAssert);
				}
				catch (error) {
					dfd.reject(error);
				}
			});
		},

		module: function (name: string, lifecycle?: QUnitHooks) {
			currentSuites = [];
			executor.addSuite(function (parentSuite: Suite) {
				const suite = new Suite(<any>{ name: name, parent: parentSuite, _qunitContext: {} });
				parentSuite.tests.push(suite);
				currentSuites.push(suite);

				if (lifecycle) {
					if (lifecycle.before) {
						after(suite, 'beforeEach', function (this: QUnitSuite) {
							lifecycle.before!.call(this._qunitContext);
						});
					}

					if (lifecycle.after) {
						after(suite, 'afterEach', function (this: QUnitSuite) {
							lifecycle.after!.call(this._qunitContext);
						});
					}
				}
			});
		},

		test(name: string, test?: QUnitTestFunction) {
			registerTest(name, function (this: QUnitTest) {
				const testAssert = create(baseAssert, { _expectedAssertions: NaN, _numAssertions: 0 });
				test!.call(this.parent._qunitContext, testAssert);
				testAssert.verifyAssertions();
			});
		},

		// callbacks
		begin(callback) {
			executor.on('runStart', function (executor: Executor) {
				const numTests = executor.suites.reduce((numTests, suite) => {
					return numTests + suite.numTests;
				}, 0);

				callback({ totalTests: numTests });
			});
		},

		done(callback) {
			executor.on('runEnd', function (executor: Executor) {
				const numFailedTests = executor.suites.reduce((numTests: number, suite: Suite) => {
					return numTests + suite.numFailedTests;
				}, 0);
				const numTests = executor.suites.reduce((numTests: number, suite: Suite) => {
					return numTests + suite.numTests;
				}, 0);
				const numSkippedTests = executor.suites.reduce((numTests: number, suite: Suite) => {
					return numTests + suite.numSkippedTests;
				}, 0);
				const timeElapsed = Math.max.apply(null, executor.suites.map((suite: Suite) => {
					return suite.timeElapsed;
				}));

				callback({
					failed: numFailedTests,
					passed: numTests - numFailedTests - numSkippedTests,
					total: numTests,
					runtime: timeElapsed
				});
			});
		},

		log(callback) {
			executor.on('testEnd', function (test: QUnitTest) {
				callback({
					result: test.hasPassed,
					actual: test.error && test.error.actual,
					expected: test.error && test.error.expected,
					message: test.error && test.error.message,
					source: test.error && test.error.stack,
					module: test.parent.name,
					name: test.name
				});
			});
		},

		moduleDone(callback) {
			executor.on('suiteEnd', function (suite: QUnitSuite) {
				if (suite._qunitContext) {
					callback({
						name: suite.name,
						failed: suite.numFailedTests,
						passed: suite.numTests - suite.numFailedTests - suite.numSkippedTests,
						total: suite.numTests,
						runtime: suite.timeElapsed
					});
				}
			});
		},

		moduleStart(callback) {
			executor.on('suiteStart', function (suite: QUnitSuite) {
				if (suite._qunitContext) {
					callback({
						name: suite.name
					});
				}
			});
		},

		testDone(callback) {
			executor.on('testEnd', function (test: QUnitTest) {
				callback({
					name: test.name,
					module: test.parent.name,
					failed: test.hasPassed ? 0 : 1,
					passed: test.hasPassed ? 1 : 0,
					total: 1,
					runtime: test.timeElapsed
				});
			});
		},

		testStart(callback) {
			executor.on('testStart', function (test) {
				callback({
					name: test.name,
					module: test.parent.name
				});
			});
		}
	};
}

export interface QUnitTestFunction {
	(assert: QUnitBaseAssert): void;
}

interface QUnitSuite extends Suite {
	_qunitContext: any;
}

interface QUnitTest extends Test {
	parent: QUnitSuite;
}

export interface QUnitAssertions {
	deepEqual(actual: any, expected: any, message?: string): void;
	equal(actual: any, expected: any, message?: string): void;
	expect(numTotal?: number): void | number;
	notDeepEqual(actual: any, expected: any, message?: string): void;
	notEqual(actual: any, expected: any, message?: string): void;
	// notOk(state: any, message?: string): void;
	notPropEqual(actual: any, expected: any, message?: string): void;
	notStrictEqual(actual: any, expected: any, message?: string): void;
	ok(state: any, message?: string): void;
	push(ok: boolean, actual: any, expected: any, message?: string): void;
	// pushResult(assertionResult: AssertionResult): void;
	propEqual(actual: any, expected: any, message?: string): void;
	strictEqual(actua: any, expected: any, message?: string): void;
	throws(block: Function, expected: Object | RegExp | Error, message?: string): void;
	raises(block: Function, expected: Object | RegExp | Error, message?: string): void;
	verifyAssertions(): void;
}

export interface QUnitBaseAssert extends QUnitAssertions {
	_expectedAssertions: number;
	_numAssertions: number;
}

export interface QUnitConfig {
	autostart: boolean;
	_module: string;
	module: string;
	requireExpects: boolean;
	testTimeout: number;
}

export interface QUnitHooks {
	before?: () => void;
	beforeEach?: () => void;
	afterEach?: () => void;
	after?: () => void;
}

let currentSuites: Suite[];

function registerTest(name: string, test: QUnitTestFunction) {
	currentSuites.forEach(suite => {
		suite.tests.push(new Test({
			name: name,
			parent: suite,
			test: <any> test
		}));
	});
}

function wrapChai(name: string) {
	return function (this: QUnitBaseAssert) {
		// TODO: Could try/catch errors to make them act more like the way QUnit acts, where an assertion failure
		// does not fail the test, but not sure of the best way to get multiple assertion failures out of a test
		// like that
		++this._numAssertions;
		(<{ [key: string]: any }> assert)[name].apply(assert, arguments);
	};
}

/**
 * Escape special characters in a regexp string
 */
function escapeRegExp(str: any) {
	return String(str).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
