define([
	'intern!object',
	'intern/chai!assert',
	'require',
	'../../lib/Suite',
	'../../lib/Test'
], function (registerSuite, assert, require, Suite, Test) {
	// TODO: These tests are wrong because they exercise the WebDriver code from the copy of Intern being used to run
	// the tests, not the code of the copy of Intern under test. The remote API needs to be improved to be correctly
	// testable in isolation.
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

		'failure recovery': function () {
			var dfd = this.async(10000),
				testUrl = require.toUrl('./data/basic.html'),
				testStoppedAfterError = true,
				numCallbacks = 0;

			var suite = new Suite({
				name: 'failing test suite',
				// TODO: Need to generate our own remote object for testing
				remote: this.remote
			});

			suite.tests.push(
				new Test({
					name: 'failing test',
					test: function () {
						return this.remote.get(testUrl)
							.then(function () {
								++numCallbacks;
								throw new Error('An intentional failure occurred');
							})
							.then(function () {
								testStoppedAfterError = false;
							});
					},
					parent: suite
				}),
				new Test({
					name: 'passing test',
					test: function () {
						return this.remote.get(testUrl)
							.then(function () {
								++numCallbacks;
							});
					},
					parent: suite
				})
			);

			suite.run().always(dfd.callback(function () {
				assert.isTrue(testStoppedAfterError, 'Additional commands should not be called after a PWD chain fails');
				assert.strictEqual(suite.numTests, 2, 'There should be at least one failing and one passing test in the suite');
				assert.strictEqual(suite.numFailedTests, 1, 'Only tests that are designed to intentionally fail should fail');
				assert.strictEqual(numCallbacks, 2, 'Failed test should not prevent successful test from executing');
			}));
		},

		'nested commands': function () {
			var remote = this.remote,
				expected = [ 'Basic test', 'Functional test', true ],
				actual = [];

			return remote.get(require.toUrl('./data/basic.html'))
				.title()
				.then(function (title) {
					assert.strictEqual(title, 'Basic test');
					actual.push(title);

					return remote.elementByTagName('h1')
						.text()
						.then(function (headerText) {
							assert.strictEqual(headerText, 'Functional test');
							actual.push(headerText);
						})
						.end();
				})
				.execute(function () {
					return window.executeWorks;
				})
				.then(function (executeWorks) {
					assert.isTrue(executeWorks);
					actual.push(executeWorks);

					assert.deepEqual(actual, expected, 'Commands should execute in the correct order');
				});
		}
	});
});
