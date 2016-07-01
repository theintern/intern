define([
	'require',
	'intern!object',
	'intern/chai!assert'
], function (
	require,
	registerSuite,
	assert
) {
	registerSuite({
		name: 'hello',

		'check contents': function () {
			// Functional tests should return a command chain based on the remote object
			return this.remote
				// Use require.toUrl to get a relative URL to a resource
				.get(require.toUrl('./page.html'))
				.findByClassName('bar')
				.getVisibleText()
				.then(function (text) {
					assert.strictEqual(text, 'Foo');
				});
		}
	});
});
