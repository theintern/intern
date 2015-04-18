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

		'module': {
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

			'should create a subsuite': function () {
				QUnit.module('qunit test 1');
				assert.strictEqual(main.suites[0].tests[0].name, 'qunit test 1', 'First registered module should have name "qunit test 1');
				assert.strictEqual(main.suites[0].tests[0].parent.name, 'qunit root suite 1', 'First registered module\'s parent name should be "qunit root suite 1"');
			},

			'should have working setup and teardown method': function () {
				QUnit.module('qunit test 1', {
					setup: function () {},
					teardown: function () {}
				});

				assert.typeOf(main.suites[0].tests[0].afterEach, 'Function', 'afterEach of the created suite should have type "Function"');
				assert.typeOf(main.suites[0].tests[0].beforeEach, 'Function', 'beforeEach of the created suite should have type "Function"');
			},
		}


	});

});
