define([
	'intern!object',
	'intern/chai!assert',
	'../../../../main!cucumber',
	'../../../../main',
	'../../../../lib/executors/Executor',
	'../../../../lib/Suite',
	'../../../../lib/Test'
], function (registerSuite, assert, registerCucumber, main, Executor, Suite, Test) {
	var originalExecutor;
	var rootSuite;

	registerSuite({
		name: 'intern/lib/interfaces/cucumber',

		setup: function () {
			originalExecutor = main.executor;
		},

		teardown: function () {
			main.executor = originalExecutor;
			originalExecutor = null;
		},

		beforeEach: function () {
			main.executor = new Executor({ reporters: [] }, { registerErrorHandler: function () {} });
			rootSuite = new Suite({ name: null, reporterManager: main.executor.reporterManager });
			main.executor.suites = [ rootSuite ];
		},

		afterEach: function () {
			rootSuite = main.executor = null;
		},

		'test sanity checking': function () {
			assert.strictEqual(main.executor.suites.length, 1, 'There should be exactly one root suite');
			assert.instanceOf(main.executor.suites[0], Suite, 'Root suite 1 should be a suite instance');
			assert.strictEqual(main.executor.suites[0].name, null, 'Root suite 1 should have no name');
		},

		'registering a cucumber creates one empty child suite': function() {
			registerCucumber(
				'Feature: ...',
				function() {}
			);
			assert.strictEqual(rootSuite.tests.length, 1, 'There should be exactly one child suite');
			assert.instanceOf(rootSuite.tests[0], Suite, 'Child suite 1 should be a suite instance');
			assert.strictEqual(rootSuite.tests[0].name, null, 'Child suite 1 should have no name');
			assert.strictEqual(rootSuite.tests[0].tests.length, 0, 'Child suite 1 should have no tests');
		},

		'one scenario gives one test case': function() {
			registerCucumber(
				'Feature: ...\nScenario: A scenario\nGiven x = 5',
				function() { this.Given('x = 5', function() {}); }
			);
			return rootSuite.run().then(function () {
				var parentSuite = rootSuite.tests[0];
				assert.strictEqual(parentSuite.tests.length, 1, 'Parent suite 1 should have one test');
				var test = parentSuite.tests[0];
				assert.instanceOf(test, Test, 'Test 1 should be a test instance');
				assert.strictEqual(test.name, 'A scenario', 'Test 1 should have the right name');
				assert.strictEqual(test.hasPassed, true, 'Test 1 should have passed');
				assert.strictEqual(parentSuite.numTests, 1, 'numTests shoud be 1');
				assert.strictEqual(parentSuite.numFailedTests, 0, 'numFailedTests shoud be 0');
			});
		},

		'a scenario outline gives multiple test cases': function() {
			registerCucumber(
				'Feature: ...\nScenario Outline: A scenario with examples\nGiven x = <x>\nExamples:\n|x|\n|1|\n|2|\n|3|\n',
				function() { this.Given('x = $value', function(value) {}); }
			);
			return rootSuite.run().then(function () {
				var parentSuite = rootSuite.tests[0];
				assert.strictEqual(parentSuite.tests.length, 3, 'Parent suite 1 should have three tests');
				parentSuite.tests.forEach(function(test) {
					assert.instanceOf(test, Test, 'Test should be a test instance');
					assert.strictEqual(test.name, 'A scenario with examples', 'Test should have the right name');
					assert.strictEqual(test.hasPassed, true, 'Test 1 should have passed');
				});
				assert.strictEqual(parentSuite.numTests, 3, 'numTests shoud be 3');
				assert.strictEqual(parentSuite.numFailedTests, 0, 'numFailedTests shoud be 0');
			});
		},

		'it is possible to pass multiple step definition functions': function() {
			registerCucumber(
				'Feature: ...\nScenario: A scenario\nGiven x = 5\nThen x == 5',
				function() { this.Given('x = 5', function() {}); },
				function() { this.Then('x == 5', function() {}); }
			);
			return rootSuite.run().then(function () {
				var parentSuite = rootSuite.tests[0];
				assert.strictEqual(parentSuite.tests.length, 1, 'Parent suite 1 should have one test');
				var test = parentSuite.tests[0];
				assert.instanceOf(test, Test, 'Test 1 should be a test instance');
				assert.strictEqual(test.name, 'A scenario', 'Test 1 should have the right name');
				assert.strictEqual(test.hasPassed, true, 'Test 1 should have passed');
				assert.strictEqual(parentSuite.numTests, 1, 'numTests shoud be 1');
				assert.strictEqual(parentSuite.numFailedTests, 0, 'numFailedTests shoud be 0');
			});
		},

		'failing steps should give error': function() {
			registerCucumber(
				'Feature: ...\nScenario: A failing test step\nGiven x = 5\nAnd y = 5',
				function() {
					this.Given('x = 5', function() {});
					this.Given('y = 5', function() { assert.ok(false, 'This fails'); });
				}
			);
			return rootSuite.run().then(function() {
				var test = rootSuite.tests[0].tests[0];
				assert.strictEqual(test.hasPassed, false, 'Test 1 should not have passed');
				assert.deepEqual(
		  			test.error.message,
		  			'"Given y = 5" failed:\nThis fails: expected false to be truthy',
		  			'Test 1 should have the right error message'
  				);
				assert.strictEqual(rootSuite.tests[0].numFailedTests, 1, 'numFailedTests shoud be 1');
			});
		},

		'missing Given step definition should give error': function() {
			registerCucumber('Feature: ...\nScenario: A scenario\nGiven x = 5', function() {});
			return rootSuite.run().then(function () {
				var test = rootSuite.tests[0].tests[0];
				assert.strictEqual(test.hasPassed, false, 'Test 1 should not have passed');
				assert.deepEqual(
		  			test.error.message,
		  			'"Given x = 5" does not have a matching step definition',
		  			'Test 1 should have the right error message'
  				);
				assert.strictEqual(rootSuite.tests[0].numFailedTests, 1, 'numFailedTests shoud be 1');
			});
		},

		'ambigous step definitions should give error': function() {
			registerCucumber(
				'Feature: ...\nScenario: A scenario\nGiven x = 5',
				function() {
					this.Given('x = 5', function() {});
					this.When('x = 5', function() {});
				}
			);
			return rootSuite.run().then(function () {
				var test = rootSuite.tests[0].tests[0];
				assert.strictEqual(test.hasPassed, false, 'Test 1 should not have passed');
				assert.include(
					test.error.message,
					'Multiple step definitions match:',
					'Test 1 should have the right error message'
  				);
				assert.strictEqual(rootSuite.tests[0].numFailedTests, 1, 'numFailedTests shoud be 1');
			});
		},

		'syntax errors in feature source should give error': function() {
			registerCucumber('... garbage in ...', function() {});
			return rootSuite.run().then(function () {
				assert.strictEqual(rootSuite.tests[0].tests.length, 0, 'Child suite 1 should have no tests');
				assert.isDefined(rootSuite.tests[0].error, 'Child suite 1 should have an error');
			});
		}

	});
});
