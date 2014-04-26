define([
	'intern!object',
	'intern/chai!assert',
	'../../../main!cucumber',
	'../../../main!cucumber!tests/data/cucumber/simple',
	'../../../main',
	'../../../lib/Suite',
	'intern/chai!assert'
], function (registerSuite, cucumber1, cucumber2, object, main, Suite, assert) {
	var feature = ''
		+ 'Feature: simple suite\n'
		+ '  I should be able to use features in a string\n'
		+ '  Scenario: assert_equal\n'
		+ '	   Given x = 5\n'
		+ '	   And y = 5\n'
		+ '	   Then I can assert that x == y\n'
		+ '  Scenario: assert_not_equal\n'
		+ '	   Given x = 5\n'
		+ '	   And y = 7\n'
		+ '	   Then I can assert that x == y';

	registerSuite({
		name: 'intern/lib/interfaces/cucumber',

		setup: function () {
			main.suites.push(new Suite({ name: 'cucumber test 1' }));
		},

		'Provide features': function () {
			// register a cucumber suite 
			cucumber1(function () {}, feature);

			var suite = main.suites[0];
			console.log('got suite', suite);
			assert.strictEqual(suite.tests.length, 1, 'Main suite should have 1 sub-suite');
		}
	});
});
