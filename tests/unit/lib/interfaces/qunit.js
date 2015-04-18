define([
	'intern!object',
	'intern/chai!assert',
	'intern/chai!should',
	'../../../../main!tdd',
	'../../../../main!qunit',
	'../../../../main',
	'../../../../lib/Suite',
	'../../../../lib/Test'
], function (registerSuite, assert, should, tdd, QUnit, main, Suite, Test) {
	var shouldInstance = should();

	registerSuite({
		name: 'intern/lib/interfaces/qunit',

		beforeEach: function () {
			main.suites.push(
				new Suite({ name: 'qunit root suite 1'})
			);
		},

		afterEach: function () {
			main.suites.splice(0, 1);
		},

		'should have a root suite': function () {
			assert.strictEqual(main.suites.length, 1, 'There should be exactly one root suite');
			assert.instanceOf(main.suites[0], Suite, 'Root suite 1 should be a suite instance');
			assert.strictEqual(main.suites[0].name, 'qunit root suite 1', 'Root suite 1 should be the one named "qunit root suite 1"');
		},

		'module': {
			'should create a subsuite': function () {
				QUnit.module('qunit suite 1');
				assert.strictEqual(main.suites[0].tests[0].name, 'qunit suite 1', 'First registered module should have name "qunit suite 1');
				assert.strictEqual(main.suites[0].tests[0].parent.name, 'qunit root suite 1', 'First registered module\'s parent name should be "qunit root suite 1"');
			},

			'should have working setup and teardown method': function () {
				QUnit.module('qunit suite 1', {
					setup: function () {},
					teardown: function () {}
				});

				assert.typeOf(main.suites[0].tests[0].afterEach, 'Function', 'afterEach of the created suite should have type "Function"');
				assert.typeOf(main.suites[0].tests[0].beforeEach, 'Function', 'beforeEach of the created suite should have type "Function"');
			},
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

				shouldInstance.not.exist(main.suites[0].tests[0].tests[0], 'There should not be any tests registered in module named "qunit suite 1"');
				shouldInstance.exist(main.suites[0].tests[1].tests[0], 'There be a test registered in module named "qunit suite 1"');
				assert.strictEqual(main.suites[0].tests[1].tests[0].name, 'qunit test 1', 'Module 2 should register a test named "qunit test 1"');
				assert.strictEqual(main.suites[0].tests[1].tests[0].parent.name, 'qunit suite 2', 'Test should be registered under module named "qunit suite 2"');
			}
		}

	});

});
