define([
	'intern!object',
	'intern/chai!assert',
	'require'
], function (registerSuite, assert, require) {
	// TODO: These tests are wrong because they exercise the WebDriver code from the copy of Intern being used to run
	// the tests, not the code of the copy of Intern under test. The remote API needs to be improved to be correctly
	// testable in isolation.
	registerSuite({
		name: 'functional context',

		'element context': function () {
			return this.remote.get(require.toUrl('./data/contexts.html'))
				.elementById('a')
					.text()
					.then(function (text) {
						assert.strictEqual(text, 'A\nINNER');
					})
					.elementByClassName('b')
						.then(function (text) {
							assert.strictEqual(text, 'INNER');
						})
					.end()
				.end()
				.elementById('c')
					.text()
					.then(function (text) {
						assert.strictEqual(text, 'C');
					});
		},

		'context resets automatically for new test': function () {
			return this.remote.get(require.toUrl('./data/contexts.html'))
				.elementByClassName('b')
				.text()
				.then(function (text) {
					assert.strictEqual(text, 'OUTER');
				});
		}
	});

	// TODO: Test that context is not retained after resetting the remote
});
