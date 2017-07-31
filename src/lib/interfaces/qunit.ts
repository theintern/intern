import { on } from '@dojo/core/aspect';
import { create } from '@dojo/core/lang';
import Suite from '../Suite';
import Test from '../Test';
import { Handle } from '@dojo/interfaces/core';
import intern from '../../intern';
import Executor from '../executors/Executor';
import WeakMap from '@dojo/shim/WeakMap';

let interfaces = new WeakMap<Executor, QUnitInterface>();

function getExecutor(executor?: Executor) {
	return executor || intern();
}

export interface QUnitAssertions {
	deepEqual(actual: any, expected: any, message?: string): void;
	equal(actual: any, expected: any, message?: string): void;
	expect(numTotal: number): void;
	expect(): number;
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

export type QUnitCallback<T> = (data: T) => void;

export interface QUnitConfig {
	autostart: boolean;
	module: string | undefined;
	requireExpects: boolean;
	testTimeout: number;
}

export interface QUnitBeginData {
	totalTests: number;
}

export interface QUnitDoneData {
	failed: number;
	passed: number;
	runtime: number;
	total: number;
}

export interface QUnitHooks {
	setup?(): void;
	teardown?(): void;
}

export interface QUnitInterface {
	assert: QUnitAssertions;
	config: QUnitConfig;
	extend<T extends {}, U extends {}>(target: T, mixin: U, skipExistingTargetProperties?: boolean): T & U;
	start(): void;
	stop(): void;
	asyncTest(name: string, test: QUnitTestFunction): void;
	module(name: string, hooks?: QUnitHooks): void;
	test(name: string, test: QUnitTestFunction): void;
	begin(callback: QUnitCallback<QUnitBeginData>): void;
	done(callback: QUnitCallback<QUnitDoneData>): void;
	log(callback: QUnitCallback<QUnitLogData>): void;
	moduleDone(callback: QUnitCallback<QUnitModuleDoneData>): void;
	moduleStart(callback: QUnitCallback<QUnitModuleStartData>): void;
	testDone(callback: QUnitCallback<QUnitTestDoneData>): void;
	testStart(callback: QUnitCallback<QUnitTestStartData>): void;
}

export interface QUnitLogData {
	actual: any;
	expected: any;
	message?: string;
	module: string;
	name: string;
	result: boolean;
	source?: string;
}

export interface QUnitModuleDoneData extends QUnitModuleStartData, QUnitDoneData {}

export interface QUnitModuleStartData {
	name: string;
}

export interface QUnitTestDoneData extends QUnitModuleDoneData, QUnitTestStartData {}

export interface QUnitTestFunction {
	(assert: QUnitBaseAssert): void;
}

export interface QUnitTestStartData extends QUnitModuleStartData {
	module: string;
}

function getBaseAssert(executor?: Executor): QUnitBaseAssert {
	let assert: Chai.AssertStatic;
	let AssertionError: typeof Chai.AssertionError;

	function wrapChai(name: keyof Chai.AssertStatic) {
		return function (this: QUnitBaseAssert): void {
			if (!assert) {
				executor = getExecutor(executor);
				const chai = executor.getPlugin('chai');
				assert = chai.assert;
			}
			// TODO: Could try/catch errors to make them act more like the way QUnit acts, where an assertion failure
			// does not fail the test, but not sure of the best way to get multiple assertion failures out of a test
			// like that
			++this._numAssertions;
			assert[name].apply(assert, arguments);
		};
	}

	AssertionError = <any> function (message: string, props: any, ssf: any) {
		executor = getExecutor(executor);
		AssertionError = executor.getPlugin('chai').AssertionError;

		return new AssertionError(message, props, ssf);
	};

	return {
		_expectedAssertions: NaN,
		_numAssertions: 0,

		deepEqual: wrapChai('deepEqual'),
		equal: wrapChai('equal'),
		expect: function (this: QUnitBaseAssert, numTotal?: number) {
			if (typeof numTotal !== 'undefined') {
				this._expectedAssertions = numTotal;
			}
			else {
				return this._expectedAssertions;
			}
		} as QUnitAssertions['expect'],
		notDeepEqual: wrapChai('notDeepEqual'),
		notEqual: wrapChai('notEqual'),
		notPropEqual: wrapChai('notDeepEqual'),
		notStrictEqual: wrapChai('notStrictEqual'),
		ok: wrapChai('ok'),
		push(ok, actual, expected, message) {
			++this._numAssertions;
			if (!ok) {
				throw new AssertionError(message!, { actual, expected });
			}
		},
		propEqual: wrapChai('deepEqual'),
		strictEqual: wrapChai('strictEqual'),
		throws: ((): QUnitBaseAssert['throws'] => {
			const throws = wrapChai('throws');
			return function (this: QUnitBaseAssert, fn, expected, message) {
				if (typeof expected === 'function') {
					++this._numAssertions;
					try {
						fn();
						throw new AssertionError(
							(message ? message + ': ' : '') +
							'expected [Function] to throw'
						);
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

		raises() {
			return this.throws.apply(this, arguments);
		},

		verifyAssertions() {
			if (!executor) {
				executor = getExecutor(executor);
			}
			if (isNaN(this._expectedAssertions) && getInterface(executor).config.requireExpects) {
				throw new AssertionError('Expected number of assertions to be defined, but expect() was ' +
					'not called.');
			}

			if (!isNaN(this._expectedAssertions) && this._numAssertions !== this._expectedAssertions) {
				throw new AssertionError('Expected ' + this._expectedAssertions + ' assertions, but ' +
					this._numAssertions + ' were run');
			}
		}
	};
}

function getConfig(executor?: Executor): QUnitConfig {
	let autostartHandle: Handle | undefined;
	let moduleName: string | undefined;

	return {
		get autostart() {
			return !autostartHandle;
		},
		set autostart(value) {
			if (autostartHandle) {
				autostartHandle.destroy();
				autostartHandle = undefined;
			}

			if (!value) {
				if (!executor) {
					executor = getExecutor(executor);
				}

				const QUnit = getInterface(executor);
				autostartHandle = executor.on('beforeRun', () => {
					return new Promise<void>(resolve => {
						QUnit.start = resolve;
					});
				});

				QUnit.start = () => {
					autostartHandle!.destroy();
					autostartHandle = undefined;
					QUnit.start = function () {};
				};
			}
		},
		get module() {
			return moduleName;
		},
		set module(value) {
			moduleName = value;
			getExecutor(executor).addSuite(suite => {
				suite.grep = new RegExp('(?:^|[^-]* - )' + escapeRegExp(value) + ' - ', 'i');
			});
		},
		requireExpects: false,
		testTimeout: Infinity
	};
}

export function getInterface(executor: Executor) {
	if (interfaces.has(executor)) {
		return interfaces.get(executor)!;
	}

	let currentSuites: Suite[];

	function registerTest(name: string, test: QUnitRegisterTestFunction) {
		currentSuites.forEach(parent => {
			parent.tests.push(new Test({
				name,
				parent,
				test
			}));
		});
	}

	const baseAssert = executor === intern() ? assert : getBaseAssert(executor);
	const _config = executor === intern() ? config : getConfig(executor);

	const QUnit: QUnitInterface = {
		assert: baseAssert,
		get config() {
			return _config;
		},

		extend,

		start() {},
		stop() {},

		// test registration
		asyncTest(name, test) {
			registerTest(name, self => {
				self.timeout = QUnit.config.testTimeout;

				let numCallsUntilResolution = 1;
				const dfd = self.async();
				const testAssert = create(baseAssert, { _expectedAssertions: NaN, _numAssertions: 0 });

				QUnit.stop = function () {
					++numCallsUntilResolution;
				};
				QUnit.start = dfd.rejectOnError(() => {
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
					test.call(self.parent._qunitContext, testAssert);
				}
				catch (error) {
					dfd.reject(error);
				}
			});
		},

		module(name, hooks) {
			currentSuites = [];
			executor.addSuite(parentSuite => {
				const suite = new Suite({ name: name, parent: parentSuite, _qunitContext: {} } as any);
				parentSuite.tests.push(suite);
				currentSuites.push(suite);

				if (hooks) {
					if (hooks.setup) {
						on(suite, 'beforeEach', function (this: QUnitSuite) {
							hooks.setup!.call(this._qunitContext);
						});
					}

					if (hooks.teardown) {
						on(suite, 'afterEach', function (this: QUnitSuite) {
							hooks.teardown!.call(this._qunitContext);
						});
					}
				}
			});
		},

		test(name, test) {
			registerTest(name, self => {
				const testAssert = create(baseAssert, { _expectedAssertions: NaN, _numAssertions: 0 });
				test.call(self.parent._qunitContext, testAssert);
				testAssert.verifyAssertions();
			});
		},

		// callbacks
		begin(callback) {
			executor.on('runStart', (executor: Executor) => {
				const totalTests = executor.suites.reduce((numTests, suite) => {
					return numTests + suite.numTests;
				}, 0);

				callback({ totalTests });
			});
		},
		done(callback) {
			executor.on('runEnd', (executor: Executor) => {
				const failed = executor.suites.reduce((numTests, suite) => {
					return numTests + suite.numFailedTests;
				}, 0);
				const total = executor.suites.reduce((numTests, suite) => {
					return numTests + suite.numTests;
				}, 0);
				const numSkippedTests = executor.suites.reduce(function (numTests, suite) {
					return numTests + suite.numSkippedTests;
				}, 0);
				const runtime = Math.max.apply(null, executor.suites.map(function (suite) {
					return suite.timeElapsed;
				}));

				callback({
					failed,
					passed: total - failed - numSkippedTests,
					total,
					runtime
				});
			});
		},
		log(callback) {
			executor.on('testEnd', (test: QUnitTest) => {
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
			executor.on('suiteEnd', (suite: QUnitSuite) => {
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
			executor.on('suiteStart', (suite: QUnitSuite) => {
				if (suite._qunitContext) {
					callback({
						name: suite.name
					});
				}
			});
		},
		testDone(callback) {
			executor.on('testEnd', (test: QUnitTest) => {
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
			executor.on('testStart', (test: QUnitTest) => {
				callback({
					name: test.name,
					module: test.parent.name
				});
			});
		}
	};

	interfaces.set(executor, QUnit);

	return QUnit;
}

export const assert: QUnitAssertions = getBaseAssert();
export const config = getConfig();

export function extend<T extends {}, U extends {}>(target: T, mixin: U, skipExistingTargetProperties?: boolean): T & U {
	const result: typeof target & typeof mixin = target as any;
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
}

export function start() {
	getInterface(intern()).start();
}

export function stop() {
	getInterface(intern()).stop();
}

export function asyncTest(name: string, test: QUnitTestFunction) {
	getInterface(intern()).asyncTest(name, test);
}

export function module(name: string, hooks?: QUnitHooks) {
	getInterface(intern()).module(name, hooks);
}

export function test(name: string, test: QUnitTestFunction) {
	getInterface(intern()).test(name, test);
}

export function begin(callback: QUnitCallback<QUnitBeginData>) {
	getInterface(intern()).begin(callback);
}

export function done(callback: QUnitCallback<QUnitDoneData>) {
	getInterface(intern()).done(callback);
}

export function log(callback: QUnitCallback<QUnitLogData>) {
	getInterface(intern()).log(callback);
}

export function moduleDone(callback: QUnitCallback<QUnitModuleDoneData>) {
	getInterface(intern()).moduleDone(callback);
}

export function moduleStart(callback: QUnitCallback<QUnitModuleStartData>) {
	getInterface(intern()).moduleStart(callback);
}

export function testDone(callback: QUnitCallback<QUnitTestDoneData>) {
	getInterface(intern()).testDone(callback);
}

export function testStart(callback: QUnitCallback<QUnitTestStartData>) {
	getInterface(intern()).testStart(callback);
}

interface QUnitRegisterTestFunction {
	(this: QUnitTest, test: QUnitTest): void | PromiseLike<void>;
}

interface QUnitSuite extends Suite {
	_qunitContext: any;
}

interface QUnitTest extends Test {
	parent: QUnitSuite;
}

/**
 * Escape special characters in a regexp string
 */
function escapeRegExp(str: any) {
	return String(str).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
