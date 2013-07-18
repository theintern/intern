define([
	'intern!object',
	'intern/chai!assert',
	'require',
	'../../lib/Suite',
	'../../lib/Test',
	'dojo/Deferred',
	'../../lib/wd',
], function (registerSuite, assert, require, Suite, Test, Deferred, wd) {
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
		},
		'tests following a failed test should be executed (and should not automatically fail)': function() {
			var suite,
				dfd = this.async(20000),
				self = this,
				arbitaryUrl = require.toUrl('./data/basic.html');

			suite = new Suite({
				name: 'test suite',
				remote: self.remote
			});
			suite.tests = [
					new Test({
						name : 'test that passes',
						test : function() {
							return self.remote.get(arbitaryUrl)
									.then(function () {
										assert.isTrue(true, 'true isnt true');
									});
						},
						parent:suite
					}),
					new Test({
						name : 'test that fails',
						test : function() {
							return self.remote.get(arbitaryUrl)
									.then(function () {
										assert.isFalse(true, 'true isnt true');
									});
						},
						parent:suite
					}),
					new Test({
						name : 'another test that should pass',
						test : function() {
							return self.remote.get(arbitaryUrl)
									.then(function () {
										assert.isTrue(true, 'true isnt true');
									});
						},
						parent:suite
					})
				];

			suite.run()
				.always(dfd.callback(function () {
					assert.equal(1,  suite.numFailedTests, '1 test should be reported as failed');
				}));
		}
	});
});
