define([
	'intern!object',
	'intern/chai!assert',
	'../../../main!object',
	'../../../main',
	'../../../lib/Suite',
	'../../../lib/Test'
], function (registerSuite, assert, object, main, Suite, Test) {

	registerSuite({
		name: 'intern/lib/interfaces/object',

		'Object interface registration': {
			setup: function () {
				// Normally, the root suites are set up once the runner or client are configured, but we do not execute
				// the Intern under test
				main.suites.push(
					new Suite({ name: 'object test 1' }),
					new Suite({ name: 'object test 2' })
				);
			},

			teardown: function () {
				main.suites.splice(0, 2);
			},

			'registration': function () {
				object({
					name: 'root suite 1',

					'nested suite': {
						'nested test': function () {}
					},

					'regular test': function () {}
				});

				object({
					name: 'root suite 2',

					'test 2': function () {}
				});

				for (var i = 0, mainSuite; (mainSuite = main.suites[i]) && (mainSuite = mainSuite.tests); ++i) {
					assert.strictEqual(mainSuite[0].name, 'root suite 1', 'Root suite 1 should be the one named "root suite 1"');
					assert.instanceOf(mainSuite[0], Suite, 'Root suite 1 should be a Suite instance');

					assert.strictEqual(mainSuite[0].tests.length, 2, 'Root suite should have two tests');

					assert.strictEqual(mainSuite[0].tests[0].name, 'nested suite', 'First test of root suite should be the one named "nested suite"');
					assert.instanceOf(mainSuite[0].tests[0], Suite, 'Nested test suite should be a Suite instance');

					assert.strictEqual(mainSuite[0].tests[0].tests.length, 1, 'Nested suite should only have one test');

					assert.strictEqual(mainSuite[0].tests[0].tests[0].name, 'nested test', 'Test in nested suite should be the one named "test nested suite');
					assert.instanceOf(mainSuite[0].tests[0].tests[0], Test, 'Test in nested suite should be a Test instance');

					assert.strictEqual(mainSuite[0].tests[1].name, 'regular test', 'Last test in root suite should be the one named "regular test"');
					assert.instanceOf(mainSuite[0].tests[1], Test, 'Last test in root suite should a Test instance');

					assert.strictEqual(mainSuite[1].name, 'root suite 2', 'Root suite 2 should be the one named "root suite 2"');
					assert.instanceOf(mainSuite[1], Suite, 'Root suite 2 should be a Suite instance');

					assert.strictEqual(mainSuite[1].tests.length, 1, 'Root suite 2 should have one test');

					assert.strictEqual(mainSuite[1].tests[0].name, 'test 2', 'The test in root suite 2 should be the one named "test 2"');
					assert.instanceOf(mainSuite[1].tests[0], Test, 'test 2 should be a Test instance');
				}
			}
		},

		'Object interface lifecycle methods': {
			setup: function () {
				main.suites.push(
					new Suite({ name: 'object test 1' })
				);
			},

			teardown: function () {
				main.suites.splice(0, 1);
			},

			'lifecycle methods': function () {
				var suiteParams = { name: 'root suite' },
					results = [],
					expectedResults = ['before', 'beforeEach', 'afterEach', 'after'],
					lifecycleMethods = ['setup', 'beforeEach', 'afterEach', 'teardown'];

				expectedResults.forEach(function (method) {
					suiteParams[method] = function () {
						results.push(method);
					};
				});

				object(suiteParams);

				lifecycleMethods.forEach(function (method) {
					main.suites[0].tests[0][method]();
				});

				assert.deepEqual(results, expectedResults, 'object interface methods should get called when ' +
					'corresponding Suite methods get called.');

			}
		}
	});
});
