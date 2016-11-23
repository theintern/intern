import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import { AssertionError } from 'chai';
import { QUnit, QUnitBaseAssert } from '../../../../src/lib/interfaces/qunit';
import * as main from '../../../../src/main';
import { Executor } from '../../../../src/lib/executors/Executor';
import { Suite } from '../../../../src/lib/Suite';
import { Test } from '../../../../src/lib/Test';
import { InternError } from '../../../../src/interfaces';

let originalExecutor: Executor;
let rootSuite: Suite;

registerSuite({
	name: 'intern/lib/interfaces/qunit',

	before() {
		originalExecutor = main.executor;
	},

	after() {
		main.setExecutor(originalExecutor);
		originalExecutor = null;
	},

	beforeEach() {
		main.setExecutor(new Executor({ reporters: [] }, <any> { registerErrorHandler: function () {} }));
		rootSuite = new Suite({ name: null, reporterManager: main.executor.reporterManager });
		main.executor.suites = [ rootSuite ];
	},

	afterEach() {
		rootSuite = null;
		main.setExecutor();
	},

	'test sanity checking': function () {
		assert.strictEqual(main.executor.suites.length, 1, 'There should be exactly one root suite');
		assert.instanceOf(main.executor.suites[0], Suite, 'Root suite 1 should be a suite instance');
		assert.strictEqual(main.executor.suites[0].name, null, 'Root suite 1 should have no name');
	},

	'.asyncTest'() {
		QUnit.module('qunit suite 1');

		QUnit.config.testTimeout = 500;

		QUnit.asyncTest('qunit async test 1', function (assertParam: QUnitBaseAssert) {
			assertParam.ok(false);
			QUnit.start();
		});

		QUnit.asyncTest('qunit async test 2', function (assertParam: QUnitBaseAssert) {
			setTimeout(function () {
				assertParam.ok(true);
			}, 50);
		});

		QUnit.asyncTest('qunit async test 3', function (assertParam: QUnitBaseAssert) {
			setTimeout(function () {
				assertParam.ok(true);
				QUnit.start();
			}, 50);
		});

		QUnit.asyncTest('qunit async test 4', function (assertParam: QUnitBaseAssert) {
			QUnit.stop();
			setTimeout(function () {
				assertParam.ok(true);
				QUnit.start();
			}, 50);

			setTimeout(function () {
				assertParam.ok(true);
				QUnit.start();
			}, 50);
		});

		return rootSuite.run().then(function () {
			const test0 = <Test> (<Suite> rootSuite.tests[0]).tests[0];
			const test1 = <Test> (<Suite> rootSuite.tests[0]).tests[1];
			const test2 = <Test> (<Suite> rootSuite.tests[0]).tests[2];
			const test3 = <Test> (<Suite> rootSuite.tests[0]).tests[3];

			assert.isDefined(test0.error,
				'async test should throw an error on failed assertion');
			assert.isDefined(test1.error,
				'async test should fail without QUnit.start');
			assert.strictEqual(test1.error.message,
				'Timeout reached on qunit suite 1 - qunit async test 2',
				'async test should fail without QUnit.start with a timeout message');
			assert.strictEqual(test2.hasPassed, true,
				'async test should work with QUnit.start');
			assert.strictEqual(test3.hasPassed, true,
				'async test should handle QUnit.start according to number of calls to QUnit.stop');
			QUnit.config.testTimeout = Infinity;
		});
	},

	'.module': {
		'should create a subsuite'() {
			QUnit.module('qunit suite 1');
			assert.strictEqual(rootSuite.tests[0].name, 'qunit suite 1',
				'First registered module should have name "qunit suite 1');
			assert.strictEqual(rootSuite.tests[0].parent.name, null,
				'First registered module\'s parent name should be null');
		},

		'should add setup and teardown methods'() {
			QUnit.module('qunit suite 1', {
				setup: function () {},
				teardown: function () {}
			});

			assert.typeOf((<Suite> rootSuite.tests[0]).afterEach, 'Function',
				'afterEach of the created suite should have type "Function"');
			assert.typeOf((<Suite> rootSuite.tests[0]).beforeEach, 'Function',
				'beforeEach of the created suite should have type "Function"');

			QUnit.module('qunit suite 2', {});

			assert.typeOf((<Suite> rootSuite.tests[1]).afterEach, 'null',
				'afterEach of the created suite should have type "null" if not present');
			assert.typeOf((<Suite> rootSuite.tests[1]).beforeEach, 'null',
				'beforeEach of the created suite should have type "null" if not present');
		},

		'should have a working lifecycle methods'() {
			const moduleParams: { [key: string]: Function } = {};
			const results: string[] = [];
			const expectedResults = [ 'setup', 'teardown' ];
			const lifecycleMethods = [ 'beforeEach', 'afterEach' ];

			expectedResults.forEach(function (method) {
				moduleParams[method] = function () {
					results.push(method);
				};
			});

			QUnit.module('qunit suite 1', moduleParams);

			lifecycleMethods.forEach(function (method: string) {
				const suite = rootSuite.tests[0];
				(<Function> (<any> suite)[method])();
			});

			assert.deepEqual(results, expectedResults,
				'QUnit interface methods should get called when ' + 'corrosponding Suite methods all called');
		}
	},

	'asserts': {
		'.expect'() {
			const results: any[] = [];

			QUnit.module('qunit suite 1');

			QUnit.test('qunit test 1', function (assertParam) {
				assertParam.expect(1);
				results.push(assertParam._expectedAssertions);
				results.push(assertParam.expect());
			});

			return rootSuite.run().then(function () {
				assert.strictEqual(results[0], 1, 'Base assert should have "1" expected assertions');
				assert.strictEqual(results[1], 1,
					'Expect should return number of expected assertions if 0 or > 1 argument(s) is(are) passed');
			});
		},

		'.push'() {
			const results: any[] = [];

			QUnit.module('qunit suite 1');

			QUnit.test('qunit test 1', function (assertParam) {
				let actual = 1;
				const expected = 1;

				assertParam.push( actual === expected, actual, expected, '"actual" should be equal to "expected"');
				results.push(assertParam._numAssertions);

				actual = 2;

				assert.throws(function () {
					assertParam.push(
						actual === expected,
						actual,
						expected,
						'"actual" should be equal to "expected"'
					);
				}, AssertionError, 'push should throw an assertion error on fail');
			});

			return rootSuite.run().then(function () {
				assert.strictEqual(results[0], 1, 'Base assert should have "1" assertion');
			});
		},

		'.throws'() {
			assert.throws(function () {
				QUnit.assert.throws(function () {}, function () {});
			}, 'expected [Function] to throw');

			assert.throws(function () {
				QUnit.assert.throws(function () {}, function () {}, 'foo');
			}, 'foo: expected [Function] to throw');

			assert.doesNotThrow(function () {
				QUnit.assert.throws(function () {
					throw new Error('Oops');
				}, function (error: InternError) {
					return error.message === 'Oops';
				});
			}, 'Error should be passed to test function, and matching test function should not throw');

			assert.throws(function () {
				QUnit.assert.throws(function () {
					throw new Error('Oops');
				}, function () {
					return false;
				}, 'foo');
			}, 'foo: expected [Function] to throw error matching [Function] but got Error: Oops');
		}
	},

	'.test': {
		'should create and push test'() {
			QUnit.module('qunit suite 1');

			QUnit.test('qunit test 1');

			const test0 = <Test> (<Suite> rootSuite.tests[0]).tests[0];
			assert.strictEqual(test0.name, 'qunit test 1',
				'Module should register a test named "qunit test 1"');
			assert.strictEqual(test0.parent.name, 'qunit suite 1',
				'Test should be registered in module named "qunit suite 1"');
		},

		'should be added to latest module'() {
			QUnit.module('qunit suite 1');
			QUnit.module('qunit suite 2');

			QUnit.test('qunit test 1');

			const test0 = <Test> (<Suite> rootSuite.tests[0]).tests[0];
			const test1 = <Test> (<Suite> rootSuite.tests[1]).tests[0];
			assert.isUndefined(test0,
				'There should not be any tests registered in module named "qunit suite 1"');
			assert.isDefined(test1,
				'There be a test registered in module named "qunit suite 1"');
			assert.strictEqual(test1.name, 'qunit test 1',
				'Module 2 should register a test named "qunit test 1"');
			assert.strictEqual(test1.parent.name, 'qunit suite 2',
				'Test should be registered under module named "qunit suite 2"');
		},

		'should call the test function'() {
			const results: any[] = [];

			QUnit.module('qunit suite 1');

			QUnit.test('qunit test 1', function (assertParam) {
				results.push(assertParam);
			});

			const test0 = <Test> (<Suite> rootSuite.tests[0]).tests[0];
			assert.instanceOf(test0, Test,
				'test 1 should be a Test Instance');

			return rootSuite.run().then(function () {
				assert.strictEqual(QUnit.assert.isPrototypeOf(results[0]), true,
					'Assert passed to QUnit test should be instance of QUnit.assert');
			});
		}
	},

	'.config': {
		'.autostart': {
			'default'() {
				assert.strictEqual(QUnit.config.autostart, true,
					'Autostart should be true by default');
			},

			'enabled'() {
				QUnit.config.autostart = false;
				assert.strictEqual(QUnit.config.autostart, false,
					'Autostart can be set via config to false');

				let finishedBeforeCall = true;
				setTimeout(function () {
					finishedBeforeCall = false;
					QUnit.start();
				}, 100);

				return (<any> main.executor.config).before().then(function () {
					assert.isFalse(finishedBeforeCall,
						'Execution should be blocked until QUnit.start is called');
				});
			},

			'enabled, then disabled'() {
				QUnit.config.autostart = false;
				assert.strictEqual(QUnit.config.autostart, false,
					'Autostart can be set via config to false');

				assert.ok((<any> main.executor.config).before,
					'Disabling autostart should add a block to the pre-execution function');

				QUnit.config.autostart = true;
				assert.strictEqual(QUnit.config.autostart, true,
					'Autostart can be set via config to true');

				assert.isUndefined((<any> main.executor.config).before(),
					'Execution should not be blocked when autostart is true');
			}
		},

		'.module'() {
			assert.isNull(QUnit.config.module,
				'There should not be any module in config by default');

			QUnit.module('suite 1');
			QUnit.test('test 1', function () {});
			QUnit.module('suite 2');
			QUnit.test('test 2', function () {});

			QUnit.config.module = 'suite 1';

			assert.strictEqual(QUnit.config.module, 'suite 1',
				'Module filter can be set through config');

			// Reset QUnit interface state
			QUnit.config._module = null;

			return rootSuite.run().then(function () {
				const test = <Test> (<Suite> rootSuite.tests[0]).tests[0];
				const skippedTest = <Test> (<Suite> rootSuite.tests[1]).tests[0];
				assert.isTrue(test.hasPassed, 'Matching module should run and pass');
				assert.strictEqual(skippedTest.skipped, 'grep',
					'Non-matching module should be skipped');
			});
		},

		'.requireExpects'() {
			QUnit.module('qunit suite 1');

			QUnit.config.requireExpects = true;

			QUnit.test('qunit test 1', function (assertParam) {
				assertParam.expect(0);
			});

			// This test should fail even though it has no failures because it is missing `expects`
			QUnit.test('qunit test 2', function () {});

			return rootSuite.run().finally(function () {
				QUnit.config.requireExpects = false;
			}).then(function () {
				const passedTest = <Test> (<Suite> rootSuite.tests[0]).tests[0];
				const failedTest = <Test> (<Suite> rootSuite.tests[0]).tests[1];
				assert.isTrue(passedTest.hasPassed, 'Test with `expect` should pass');
				assert.isFalse(failedTest.hasPassed, 'Test without `expect` should fail');
			});
		}
	},

	'.extend': {
		'should have a working expect'() {
			const testObject = { a: 1 };

			QUnit.extend(testObject, {
				b: { c: 1 }
			});
			assert.deepEqual(testObject, { a: 1, b: { c: 1 } }, 'Extended Object should be equal to expected one');

			QUnit.extend(testObject, { b: undefined });
			assert.deepEqual(testObject, { a: 1 }, 'Extended object should delete undefined props');

			QUnit.extend(testObject, { a: 2, b: 2 }, true);
			assert.deepEqual(testObject, { a: 1, b: 2 },
				'Extended object should set undefined props only if undef option is set');
		}
	},

	'events': {
		'begin'() {
			const results: number[] = [];
			const expectedResults = [ 3 ];

			QUnit.begin(function (param: any) {
				results.push(param.totalTests);
			});

			QUnit.module('qunit suite 1');

			QUnit.test('qunit test 1', function () {});
			QUnit.test('qunit test 2', function () {});

			QUnit.module('qunit suite 2');

			QUnit.test('qunit test 1', function () {});

			return main.executor.run().then(function () {
				assert.deepEqual(results, expectedResults,
					'Test suite should have "3" tests registered');
			});
		},

		'done'() {
			const results: number[] = [];
			const expectedResults = [ 0, 3, 3 ];
			let runtime = 0;

			QUnit.done(function (param: any) {
				results.push(param.failed, param.passed, param.total);
				runtime = param.runtime;
			});

			QUnit.module('qunit suite 1');

			QUnit.test('qunit test 1', function () {});
			QUnit.test('qunit test 2', function () {});

			QUnit.module('qunit suite 2');

			QUnit.test('qunit test 1', function () {});

			return main.executor.run().then(function () {
				assert.deepEqual(results, expectedResults,
					'results should be equal to expectedResults on "done"');
				assert.isDefined(runtime, 'runtime should be defined on "done"');
			});
		},

		'log'() {
			const results: any[] = [];
			const expectedResults = [ false, 2, 1,
				'actual should be equal to expected: expected 2 to equal 1',
				'qunit suite 1', 'qunit test 1' ];

			QUnit.log(function (param: any) {
				results.push(param.result, param.actual, param.expected,
					param.message, param.module, param.name);
			});

			QUnit.module('qunit suite 1');

			QUnit.test('qunit test 1', function (assertParam) {
				const expected = 1;
				const actual = 2;
				assertParam.strictEqual(actual, expected,
					'actual should be equal to expected');
			});

			return rootSuite.run().then(function () {
				assert.deepEqual(results, expectedResults,
					'results should be equal to expectedResults on "log"');
			});
		},

		'moduleStart'() {
			const results: string[] = [];
			const expectedResults = [ 'qunit suite 1' ];

			QUnit.moduleStart(function (param: any) {
				results.push(param.name);
			});

			QUnit.module('qunit suite 1');

			QUnit.test('qunit test 1', function () {});

			return rootSuite.run().then(function () {
				assert.deepEqual(results, expectedResults,
					'Module should have name "qunit suite 1"');
			});
		},

		'moduleDone'() {
			const results: any[] = [];
			const expectedResults = [ 'qunit suite 1', 0, 1, 1 ];
			let runtime = 0;

			QUnit.moduleDone(function (param: any) {
				results.push(param.name, param.failed, param.passed, param.total);
				runtime = param.runtime;
			});

			QUnit.module('qunit suite 1');

			QUnit.test('qunit test 1', function () {});

			return rootSuite.run().then(function () {
				assert.deepEqual(results, expectedResults, 'results should match expectedResults on "moduleDone"');
				assert.isDefined(runtime, 'Runtime should be defined on "moduleDone"');
			});
		},

		'testStart'() {
			const results: string[] = [];
			const expectedResults = ['qunit test 1'];

			QUnit.testStart(function (param: any) {
				results.push(param.name);
			});

			QUnit.module('qunit suite 1');

			QUnit.test('qunit test 1', function () {});

			return rootSuite.run().then(function () {
				assert.deepEqual(results, expectedResults, 'results should match expectedResults on "testStart"');
			});
		},

		'testDone'() {
			const results: any[] = [];
			const expectedResults = [
				'qunit test 1', 'qunit suite 1', 0, 1, 1,
				'qunit test 2', 'qunit suite 1', 1, 0, 1
			];
			const runtime: any[] = [];

			QUnit.testDone(function (param: any) {
				results.push(param.name, param.module, param.failed, param.passed, param.total);
				runtime.push(param.runtime);
			});

			QUnit.module('qunit suite 1');

			QUnit.test('qunit test 1', function () {});
			QUnit.test('qunit test 2', function (assertParam) {
				assertParam.ok(false, 'Failing test');
			});

			return rootSuite.run().then(function () {
				assert.deepEqual(results, expectedResults,
					'results should match expectedResults on "testDone"');
				assert.isDefined(runtime[0],
					'Runtime for "qunit test 1" should exist');
				assert.isDefined(runtime[1],
					'Runtime for "qunit test 2" should exist');
			});
		}
	}
});
