define([
	'intern!object',
	'intern/chai!assert',
	'require'
], function (registerSuite, assert, require) {
	registerSuite({
		name: 'basic functional test',

		'basic test': function () {
			return this.remote.get(require.toUrl('./data/basic.html'))
				.title()
				.then(function (title) {
					assert.strictEqual(title, 'Basic test');
				})
				.elementByTagName('h1')
					.text()
					.then(function (headerText) {
						assert.strictEqual(headerText, 'Functional test');
					})
					.end()
				.execute(function () {
					return window.executeWorks;
				})
				.then(function (executeWorks) {
					assert.isTrue(executeWorks);
				});
		}
	});
});