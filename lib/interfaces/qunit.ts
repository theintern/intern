import { after as aspectAfter, on } from 'dojo/aspect';
import { delegate } from 'dojo/lang';
import Promise = require('dojo/Promise');
import { assert, AssertionError } from 'intern/chai!';
import * as main from '../../main';
import { default as Suite, KwArgs as SuiteKwArgs } from '../Suite';
import Test from '../Test';
import { escapeRegExp, StackError } from '../util';

let currentSuites: Suite[];

type MaybePromise = void | Promise.Thenable<void>;

interface QUnitSuiteKwArgs extends SuiteKwArgs {
	_qunitContext: {};
}

interface QUnitSuite extends Suite {
	_qunitContext: {};
}

function registerTest(name: string, test: () => MaybePromise) {
	currentSuites.forEach(function (suite) {
		suite.tests.push(new Test({
			name: name,
			parent: suite,
			test: test
		}));
	});
}

function wrapChai(name: 'deepEqual'): typeof assert.deepEqual;
function wrapChai(name: 'equal'): typeof assert.equal;
function wrapChai(name: 'notDeepEqual'): typeof assert.notDeepEqual;
function wrapChai(name: 'notStrictEqual'): typeof assert.notStrictEqual;
function wrapChai(name: 'ok'): typeof assert.ok;
function wrapChai(name: 'strictEqual'): typeof assert.strictEqual;
function wrapChai(name: 'throws'): typeof assert.throws;
function wrapChai(name: string): (...args: any[]) => void;
function wrapChai(name: string) {
	return function () {
		// TODO: Could try/catch errors to make them act more like the way QUnit acts, where an assertion failure
		// does not fail the test, but not sure of the best way to get multiple assertion failures out of a test
		// like that
		++this._numAssertions;
		(<any> assert)[name].apply(assert, arguments);
	};
}

const baseAssert = {
	_expectedAssertions: NaN,
	_numAssertions: 0,

	deepEqual: wrapChai('deepEqual'),
	equal: wrapChai('equal'),
	expect: <{
		(numTotal: number): void;
		(): number;
	}> function (numTotal?: number) {
		if (arguments.length === 1) {
			this._expectedAssertions = numTotal;
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
	push(ok: boolean, actual: any, expected: any, message: string) {
		++this._numAssertions;
		if (!ok) {
			throw new AssertionError(message, { actual: actual, expected: expected });
		}
	},
	// TODO: deepEqual is not propEqual
	propEqual: wrapChai('deepEqual'),
	strictEqual: wrapChai('strictEqual'),
	throws: (function () {
		const throws = wrapChai('throws');
		return function (fn: () => any, expected: any, message?: string) {
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
	raises(fn: () => any, expected: any, message?: string) {
		return this.throws.apply(this, arguments);
	},

	verifyAssertions() {
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

let autostartHandle: { remove(): void; };

const QUnit = {
	assert: baseAssert,
	config: {
		_setAutostart(value: boolean): void {
			if (autostartHandle) {
				autostartHandle.remove();
				autostartHandle = null;
			}

			if (!value) {
				autostartHandle = aspectAfter(main.executor.config, 'setup', function (waitGuard: void | Promise.Thenable<void>) {
					return new Promise<void>(function (resolve) {
						QUnit.start = function (): void {
							if (waitGuard && (<Promise.Thenable<void>> waitGuard).then) {
								(<Promise.Thenable<void>> waitGuard).then(function () {
									resolve();
								});
							}
							else {
								resolve();
							}
						};
					});
				});
				QUnit.start = function (): void {
					autostartHandle.remove();
					autostartHandle = null;
					QUnit.start = function (): void {};
				};
			}
		},
		get autostart(): boolean {
			return !autostartHandle;
		},
		set autostart(value: boolean) {
			this._setAutostart(value);
		},
		_module: <string> null,
		get module() {
			return this._module;
		},
		set module(value: string) {
			this._module = value;
			main.executor.register(function (suite) {
				suite.grep = new RegExp('(?:^|[^-]* - )' + escapeRegExp(value) + ' - ', 'i');
			});
		},
		requireExpects: false,
		testTimeout: Infinity
	},

	extend(target: {}, mixin: {}, skipExistingTargetProperties?: boolean) {
		for (const key in mixin) {
			if (mixin.hasOwnProperty(key)) {
				if ((<any> mixin)[key] === undefined) {
					delete (<any> target)[key];
				}
				else if (!skipExistingTargetProperties || (<any> target)[key] === undefined) {
					(<any> target)[key] = (<any> mixin)[key];
				}
			}
		}
		return target;
	},

	start() {},
	stop() {},

	// test registration
	asyncTest(name: string, test: (assert: typeof baseAssert) => void) {
		registerTest(name, function () {
			this.timeout = QUnit.config.testTimeout;

			let numCallsUntilResolution = 1;
			const dfd = this.async();
			const testAssert = delegate(baseAssert, { _expectedAssertions: NaN, _numAssertions: 0 });

			QUnit.stop = function () {
				++numCallsUntilResolution;
			};
			QUnit.start = dfd.rejectOnError(function () {
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
	module(name: string, lifecycle?: { setup?: () => void; teardown?: () => void; }) {
		currentSuites = [];
		main.executor.register(function (parentSuite) {
			const suite = new Suite(<QUnitSuiteKwArgs> { name: name, parent: parentSuite, _qunitContext: {} });
			parentSuite.tests.push(suite);
			currentSuites.push(suite);

			if (lifecycle) {
				if (lifecycle.setup) {
					on(suite, 'beforeEach', function () {
						lifecycle.setup.call(this._qunitContext);
					});
				}

				if (lifecycle.teardown) {
					on(suite, 'afterEach', function () {
						lifecycle.teardown.call(this._qunitContext);
					});
				}
			}
		});
	},
	test(name: string, test: (assert: typeof baseAssert) => void) {
		registerTest(name, function () {
			const testAssert = delegate(baseAssert, { _expectedAssertions: NaN, _numAssertions: 0 });
			test.call(this.parent._qunitContext, testAssert);
			testAssert.verifyAssertions();
		});
	},

	// callbacks
	begin(callback: (data: { totalTests: number; }) => void) {
		main.executor.reporterManager.on('runStart', function (executor) {
			const numTests = executor.suites.reduce(function (numTests, suite) {
				return numTests + suite.numTests;
			}, 0);

			callback({ totalTests: numTests });
		});
	},
	done(callback: (data: { failed: number; passed: number; total: number; runtime: number; }) => void) {
		main.executor.reporterManager.on('runEnd', function (executor) {
			const numFailedTests = executor.suites.reduce(function (numTests, suite) {
				return numTests + suite.numFailedTests;
			}, 0);
			const numTests = executor.suites.reduce(function (numTests, suite) {
				return numTests + suite.numTests;
			}, 0);
			const numSkippedTests = executor.suites.reduce(function (numTests, suite) {
				return numTests + suite.numSkippedTests;
			}, 0);
			const timeElapsed = Math.max.apply(null, executor.suites.map(function (suite) {
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
	log(callback: (data: { result: boolean; actual: any; expected: any; message: string; source: string; module: string; name: string; }) => void) {
		main.executor.reporterManager.on('testEnd', function (test) {
			callback({
				result: test.hasPassed,
				actual: test.error && (<StackError> test.error).actual,
				expected: test.error && (<StackError> test.error).expected,
				message: test.error && test.error.message,
				source: test.error && (<StackError> test.error).stack,
				module: test.parent.name,
				name: test.name
			});
		});
	},
	moduleDone(callback: (data: { name: string; failed: number; passed: number; total: number; runtime: number; }) => void) {
		main.executor.reporterManager.on('suiteEnd', function (suite) {
			if ((<QUnitSuite> suite)._qunitContext) {
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
	moduleStart(callback: (data: { name: string; }) => void) {
		main.executor.reporterManager.on('suiteStart', function (suite) {
			if ((<QUnitSuite> suite)._qunitContext) {
				callback({
					name: suite.name
				});
			}
		});
	},
	testDone(callback: (data: { name: string; module: string; failed: number; passed: number; total: number; runtime: number; }) => void) {
		main.executor.reporterManager.on('testEnd', function (test) {
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
	testStart(callback: (data: { name: string; module: string; }) => void) {
		main.executor.reporterManager.on('testStart', function (test) {
			callback({
				name: test.name,
				module: test.parent.name
			});
		});
	}
};

export default QUnit;
