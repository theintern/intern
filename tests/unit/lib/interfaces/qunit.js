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

		},

		afterEach: function () {

		},

		'Should register a module': function () {
			QUnit.module('qunit test 1');

			for (var i = 0, mainSuite; mainSuite = main.suites[i]; ++i) {
				assert.strictEqual(mainSuite[0].name, 'qunit test 1', 'First registered module should be th one named "qunit test 1');
			}
		}


	});

});
