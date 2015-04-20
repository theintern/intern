define([
	'intern!object',
	'intern/chai!assert',
	'../../../../main!tdd',
	'../../../../main!qunit',
	'../../../../main',
	'../../../../lib/Suite',
	'../../../../lib/Test'
], function (registerSuite, assert, tdd, QUnit, main, Suite, Test) {

	registerSuite({
		name: 'intern/lib/interfaces/qunit',

		beforeEach: function () {
			main.suites.push(
				new Suite({ name: 'main'})
			);
		},

		afterEach: function () {
			main.suites.splice(0, 1);
		},

		'should have a root suite': function () {
			assert.strictEqual(main.suites.length, 1, 'There should be exactly one root suite');
			assert.instanceOf(main.suites[0], Suite, 'Root suite 1 should be a suite instance');
			assert.strictEqual(main.suites[0].name, 'main', 'Root suite 1 should be the one named "main"');
		},


		'asyncTest': function () {

			QUnit.module('qunit suite 1');

			QUnit.config.testTimeout = 100;

			QUnit.asyncTest('qunit async test 1', function (assertParam) {
				assertParam.ok(false);
				QUnit.start();
			});

			QUnit.asyncTest('qunit async test 2', function (assertParam) {
				setTimeout(function () {
					assertParam.ok(true);
				}, 100);
			});

			QUnit.asyncTest('qunit async test 3', function (assertParam) {
				setTimeout(function () {
					assertParam.ok(true);
					QUnit.start();
				}, 100);
			});

			QUnit.asyncTest('qunit async test 4', function (assertParam) {
				QUnit.stop();
				setTimeout(function () {
					assertParam.ok(true);
					QUnit.start();
				}, 100);

				setTimeout(function () {
					assertParam.ok(true);
					QUnit.start();
				}, 100);
			});

			return main.suites[0].run().then(function () {
				assert.isDefined(main.suites[0].tests[0].tests[0].error, 'async test should throw an error on failed assertion');
				assert.isDefined(main.suites[0].tests[0].tests[1].error, 1, 'async test should fail without QUnit.start');
				assert.strictEqual(main.suites[0].tests[0].tests[1].error.message, 'Timeout reached on main - qunit suite 1 - qunit async test 2', 'async test should fail without QUnit.start with a timeout message');
				assert.strictEqual(main.suites[0].tests[0].tests[2].hasPassed, true, 'async test should work with QUnit.start');
				assert.strictEqual(main.suites[0].tests[0].tests[3].hasPassed, true, 'async test should handle QUnit.start according to number of calls to QUnit.stop');
				QUnit.config.testTimeout = Infinity;
			});
		},

		'module': {
			'should create a subsuite': function () {
				QUnit.module('qunit suite 1');
				assert.strictEqual(main.suites[0].tests[0].name, 'qunit suite 1', 'First registered module should have name "qunit suite 1');
				assert.strictEqual(main.suites[0].tests[0].parent.name, 'main', 'First registered module\'s parent name should be "main"');
			},

			'should add setup and teardown methods': function () {
				QUnit.module('qunit suite 1', {
					setup: function () {},
					teardown: function () {}
				});

				assert.typeOf(main.suites[0].tests[0].afterEach, 'Function', 'afterEach of the created suite should have type "Function"');
				assert.typeOf(main.suites[0].tests[0].beforeEach, 'Function', 'beforeEach of the created suite should have type "Function"');

				QUnit.module('qunit suite 2', {});

				assert.typeOf(main.suites[0].tests[1].afterEach, 'null', 'afterEach of the created suite should have type "null" if not present');
				assert.typeOf(main.suites[0].tests[1].beforeEach, 'null', 'beforeEach of the created suite should have type "null" if not present');

			},

			'should have a working lifecycle methods': function () {
				var moduleParams = {},
					results = [],
					expectedResults = ['setup', 'teardown'],
					lifecycleMethods = ['beforeEach', 'afterEach']

				expectedResults.forEach(function (method) {
					moduleParams[method] = function () {
						results.push(method);
					};
				});

				QUnit.module('qunit suite 1', moduleParams);

				lifecycleMethods.forEach(function (method) {
					main.suites[0].tests[0][method]();
				});

				assert.deepEqual(results, expectedResults, 'QUnit interface methods should get called when ' + 'corrosponding Suite methods all called');
			}
		},

		'asserts': {
			'should have a working expect': function () {
				var results = [];

				QUnit.module('qunit suite 1');

				QUnit.test('qunit test 1', function (assertParam) {
					assertParam.expect(1);
					results.push(assertParam._expectedAssertions);
					results.push(assertParam.expect());
				});

				return main.suites[0].run().then(function () {
					assert.strictEqual(results[0], 1, 'Base assert should have "1" expected assertions');
					assert.strictEqual(results[1], 1, 'Expect should return number of expected assertions if 0 or > 1 argument(s) is(are) passed');
				});
			},

			'should have a working push': function () {
				var results = [];

				QUnit.module('qunit suite 1');

				QUnit.test('qunit test 1', function (assertParam) {
					var actual = 1;
					var expected = 1;

					assertParam.push( actual === expected, actual, expected, '"actual" should be equal to "expected"');
					results.push(assertParam._numAssertions);

					actual = 2;

					assert.throws(
						function () {
							assertParam.push( actual === expected, actual, expected, '"actual" should be equal to "expected"');
						}, assert.AssertionError, 'push should throw an assertion error on fail');
				});

				return main.suites[0].run().then(function () {
					assert.strictEqual(results[0], 1, 'Base assert should have "1" assertion');
				});
			}
		},

		'test': {
			'should create and push test': function () {
				QUnit.module('qunit suite 1');

				QUnit.test('qunit test 1');

				assert.strictEqual(main.suites[0].tests[0].tests[0].name, 'qunit test 1', 'Module should register a test named "qunit test 1"');
				assert.strictEqual(main.suites[0].tests[0].tests[0].parent.name, 'qunit suite 1', 'Test should be registered in module named "qunit suite 1"');
			},

			'should be added to latest module': function () {
				QUnit.module('qunit suite 1');
				QUnit.module('qunit suite 2');

				QUnit.test('qunit test 1');

				assert.isUndefined(main.suites[0].tests[0].tests[0], 'There should not be any tests registered in module named "qunit suite 1"');
				assert.isDefined(main.suites[0].tests[1].tests[0], 'There be a test registered in module named "qunit suite 1"');
				assert.strictEqual(main.suites[0].tests[1].tests[0].name, 'qunit test 1', 'Module 2 should register a test named "qunit test 1"');
				assert.strictEqual(main.suites[0].tests[1].tests[0].parent.name, 'qunit suite 2', 'Test should be registered under module named "qunit suite 2"');
			},

			'should call the test function': function () {
				var results = [];

				QUnit.module('qunit suite 1');

				QUnit.test('qunit test 1', function (assertParam) {
					results.push(assertParam);
				});

				assert.instanceOf(main.suites[0].tests[0].tests[0], Test, 'test 1 should be a Test Instance');

				return main.suites[0].run().then(function () {
					assert.strictEqual(QUnit.assert.isPrototypeOf(results[0]), true, 'Assert passed to QUnit test should be instance of QUnit.assert');
				});
			}
		},

		'config': {
			'should have working autostart': function () {
				assert.strictEqual(QUnit.config.autostart, true, 'Autostart should be false by default');

				QUnit.config.autostart = false;
				assert.strictEqual(QUnit.config.autostart, false, 'Autostart can be set via config to false');
				assert.strictEqual(main.args.autoRun, 'false', 'Autorun can be set via config to false');

				QUnit.config.autostart = true;
				assert.strictEqual(QUnit.config.autostart, true, 'Autostart can be set via config to true');
				assert.strictEqual(main.args.autoRun, '', 'Autorun can be set via config to ""');

				main.args.autoRun = true;
				assert.strictEqual(QUnit.config.autostart, true, 'Autostart can be set via main.args.autoRun');

				delete main.args.autoRun;
			},

			'should have working module filter': function () {
				assert.isNull(QUnit.config.module, 'There should not be any module in config by default');

				QUnit.config.module = 'suite 1';

				assert.strictEqual(QUnit.config.module, 'suite 1', 'Module filter can be set through config');
				assert.instanceOf(main.grep, RegExp, 'Main grep is set through config module');
				assert.strictEqual(main.grep.toString(), '/ - suite 1 - /i', 'Main grep should be / - suite 1 - /i');

				// Set back variables
				QUnit.config._module = null;
				main.grep = new RegExp('.*');
			},

			'should have working requireExpects': function () {
				var result;
				QUnit.module('qunit suite 1');

				QUnit.config.requireExpects = true;

				// This test should fail
				QUnit.test('qunit test 1', function (assertParam) {
					assertParam.ok(1 === 1, '1 should be equal to 1');
				});

				QUnit.testDone(function (param) {
					result = param.failed;
				});

				return main.suites[0].run().then(function () {
					assert.strictEqual(result, 1, 'Test without "QUnit.assert.expect" should fail with "requireExpects" set to true');
					QUnit.config.requireExpects = false;
				});
			}
		},

		'lifecycle': {
			'should have a working begin': function () {
				var results = [],
					expectedResults = [3];

				QUnit.begin(function (param) {
					results.push(param.totalTests);
				})

				QUnit.module('qunit suite 1');

				QUnit.test('qunit test 1', function () {});
				QUnit.test('qunit test 2', function () {});

				QUnit.module('qunit suite 2');

				QUnit.test('qunit test 1', function () {});

				return main.suites[0].run().then(function () {
					assert.deepEqual(results, expectedResults, 'Test suite should have "3" tests registered');
				});
			},

			'should have a working done': function () {
				var results = [],
					expectedResults = [0, 3, 3],
					runtime = 0;


				QUnit.done(function (param) {
					results.push(param.failed, param.passed, param.total);
					runtime = param.runtime;
				})

				QUnit.module('qunit suite 1');

				QUnit.test('qunit test 1', function () {});
				QUnit.test('qunit test 2', function () {});

				QUnit.module('qunit suite 2');

				QUnit.test('qunit test 1', function () {});

				return main.suites[0].run().then(function () {
					assert.deepEqual(results, expectedResults, 'results should be equal to expectedResults on "done"');
					assert.isDefined(runtime, 'runtime should be defined on "done"');
				});
			},

			'should have a working log': function () {
				var results = [],
					expectedResults = [false, 2, 1, 'actual should be equal to expected: expected 2 to equal 1', 'qunit suite 1', 'qunit test 1'];

				QUnit.log(function (param) {
					results.push(param.result, param.actual, param.expected, param.message, param.module, param.name);
				});

				QUnit.module('qunit suite 1');

				QUnit.test('qunit test 1', function (assertParam) {
					var expected = 1;
					var actual = 2;
					assertParam.strictEqual(actual, expected, 'actual should be equal to expected');
				});

				return main.suites[0].run().then(function () {
					assert.deepEqual(results, expectedResults, 'results should be equal to expectedResults on "log"');
				});
			},

			'should have a working moduleStart': function () {
				var results = [],
					expectedResults = ['qunit suite 1'];

				QUnit.moduleStart(function (param) {
					results.push(param.name);
				});

				QUnit.module('qunit suite 1');

				QUnit.test('qunit test 1', function () {});

				return main.suites[0].run().then(function () {
					assert.deepEqual(results, expectedResults, 'Module should have name "qunit suite 1"');
				});
			},

			'should have a working moduleDone': function () {
				var results = [],
					expectedResults = ['qunit suite 1', 0, 1, 1],
					runtime = 0;

				QUnit.moduleDone(function (param) {
					results.push(param.name, param.failed, param.passed, param.total);
					runtime = param.runtime;
				});

				QUnit.module('qunit suite 1');

				QUnit.test('qunit test 1', function () {});

				return main.suites[0].run().then(function () {
					assert.deepEqual(results, expectedResults, 'results should match expectedResults on "moduleDone"');
					assert.isDefined(runtime, 'Runtime should be defined on "moduleDone"');
				});
			},

			'should have a working testStart': function () {
				var results = [],
					expectedResults = ['qunit test 1'];

				QUnit.testStart(function (param) {
					results.push(param.name);
				});

				QUnit.module('qunit suite 1');

				QUnit.test('qunit test 1', function () {});

				return main.suites[0].run().then(function () {
					assert.deepEqual(results, expectedResults, 'results should match expectedResults on "testStart"');
				});
			},

			'should have a working testDone': function () {
				var results = [],
					expectedResults = ['qunit test 1', 'qunit suite 1', 0, 1, 1, 'qunit test 2', 'qunit suite 1', 1, 0, 1],
					runtime = [];

				QUnit.testDone(function (param) {
					results.push(param.name, param.module, param.failed, param.passed, param.total);
					runtime.push(param.runtime);
				});

				QUnit.module('qunit suite 1');

				QUnit.test('qunit test 1', function () {});
				QUnit.test('qunit test 2', function (assertParam) {
					assertParam.ok(1 === 2, 'Failing test');
				});

				return main.suites[0].run().then(function () {
					assert.deepEqual(results, expectedResults, 'results should match expectedResults on "testDone"');
					assert.isDefined(runtime[0], 'Runtime for "qunit test 1" should exist');
					assert.isDefined(runtime[1], 'Runtime for "qunit test 2" should exist');
				});
			}

		},

	});

});
