define([
	'intern!object',
	'intern/chai!assert'
], function (
	registerSuite,
	assert
) {
	registerSuite({
		name: 'hello',

		'hello world': function () {
			var foo = 'hello';
			assert.strictEqual(foo, 'hello');
		}
	});
});
