define([
	'require',
	'intern!object',
	'intern/chai!assert',
	'../../../main!cucumber',
	'../../../main!cucumber!tests/data/cucumber/simple',
	'../../../main',
	'../../../lib/Suite',
	'../../../lib/Test',
	'dojo/topic'
], function (require, registerSuite, assert, cucumber1, cucumber2, main, Suite, Test, topic) {
	var feature = ''
			+ 'Feature: simple suite\n'
			+ '  I should be able to use features in a string\n'
			+ '  Scenario: do something\n'
			+ '	   Given step 1\n'
			+ '	   And step 2\n'
			+ '	   Then profit',
		handles;

	registerSuite({
		name: 'intern/lib/interfaces/cucumber',

		beforeEach: function () {
			main.suites.push(new Suite({ name: 'cucumber' }));
		},
		
		afterEach: function () {
			main.suites.splice(0, 1);

			if (handles) {
				var handle;
				while ((handle = handles.pop())) {
					handle.remove();
				}
				handles = null;
			}
		},

		'Register feature suite': function () {
			// register a cucumber suite 
			cucumber1(function () {}, feature);

			var suite = main.suites[0];
			assert.strictEqual(suite.tests.length, 1, 'Main suite should have 1 sub-suite');
			assert.instanceOf(suite.tests[0], Suite, 'Sub-suite should be a Suite');

			suite = suite.tests[0];
			assert.strictEqual(suite.name, 'simple suite', 'Cucumber suite should have expected name');
			assert.strictEqual(suite.id, 'cucumber - simple suite', 'Cucumber suite should have expected name');
			assert.strictEqual(suite.tests.length, 1, 'Cucumber suite should have 2 tests');

			assert.instanceOf(suite.tests[0], Test, 'Test should be a Test');
			assert.strictEqual(suite.tests[0].name, 'do something', 'Test should have expected name');
		},

		'Register automatically loaded feature suite': function () {
			// register a cucumber suite 
			cucumber2(function () {});

			var suite = main.suites[0];
			assert.strictEqual(suite.tests.length, 1, 'Main suite should have 1 sub-suite');
			assert.instanceOf(suite.tests[0], Suite, 'Sub-suite should be a Suite');

			suite = suite.tests[0];
			assert.strictEqual(suite.name, 'simple external suite', 'Cucumber suite should have expected name');
			assert.strictEqual(suite.id, 'cucumber - simple external suite', 'Cucumber suite should have expected name');
			assert.strictEqual(suite.tests.length, 2, 'Cucumber suite should have 2 tests');

			var names = [ 'assert equal', 'assert not equal' ];
			for (var i = 0; i < suite.tests.length; i++) {
				assert.instanceOf(suite.tests[i], Test, 'Test ' + i + ' should be a Test');
				assert.strictEqual(suite.tests[i].name, names[i], 'Test ' + i + ' should have expected name');
			}
		},

		'passing suite': function () {
			var dfd = this.async(),
				suite = main.suites[0],
				steps = 0,
				suitesStarted = 0,
				suitesEnded = 0,
				testsStarted = 0,
				testsEnded = 0;

			cucumber2(function () {
				this.Given('x = $value', function (value, callback) {
					// will be called once for 'assert equal' test and twice for 'assert not equal' outline
					steps++;
					callback();
				});

				this.Given('y = $value', function (value, callback) {
					callback();
				});

				this.Then(/^I can/, function (callback) {
					callback();
				});
			}, feature);

			handles = [
				topic.subscribe('/suite/start', function () { suitesStarted++; }),
				topic.subscribe('/suite/end', function () { suitesEnded++; }),
				topic.subscribe('/test/start', function () { testsStarted++; }),
				topic.subscribe('/test/end', function () { testsEnded++; })
			];

			main.suites[0].tests[0].run().always(dfd.callback(function () {
				assert.strictEqual(suitesStarted, 1, 'One suite should have started');
				assert.strictEqual(testsStarted, 2, 'One test should have started');
				assert.strictEqual(steps, 3, 'Support step should have been called three times');
				assert.strictEqual(suite.numFailedTests, 0, 'No tests should have failed');
				assert.strictEqual(testsEnded, 2, 'One test should have ended');
				assert.strictEqual(suitesEnded, 1, 'One suite should have ended');
			}));
		},

		'failing step': function () {
			var dfd = this.async(),
				suite = main.suites[0],
				steps = 0,
				testsFailed = 0;

			cucumber1(function () {
				this.Given('step $step', function (value, callback) {
					steps++;
					callback.fail('fail');
				});
			}, feature);

			handles = [
				topic.subscribe('/test/fail', function () { testsFailed++; })
			];

			main.suites[0].tests[0].run().always(dfd.callback(function () {
				assert.strictEqual(steps, 1, 'Support step should have been called once');
				assert.strictEqual(testsFailed, 1, 'One test should have failed');
				assert.strictEqual(suite.numFailedTests, 1, 'Suite should report one failed test');
			}));
		}, 

		'undefined step': function () {
			var dfd = this.async(),
				steps = 0,
				suite = main.suites[0];

			cucumber1(function () {
				// "step 1" is undefined, so the test will fail and step 2 will be skipped
				this.Given('step 2', function (callback) {
					steps++;
					callback();
				});
			}, feature);

			main.suites[0].tests[0].run().always(dfd.callback(function () {
				assert.strictEqual(suite.numFailedTests, 1, 'One test should have failed');
				assert.strictEqual(steps, 0, 'No steps should have been run');
			}));
		}, 

		'with remote': function () {
			var dfd = this.async(),
				remoteValue;

			main.suites[0].remote = 'remote';

			cucumber1(function () {
				this.Given('step $step', function (value, callback) {
					remoteValue = this.remote;
					callback();
				});

				this.Then('profit', function (callback) {
					callback();
				});
			}, feature);

			main.suites[0].tests[0].run().always(dfd.callback(function () {
				assert.strictEqual(remoteValue, 'remote', 'Remote should have been visible in support code');
			}));
		},

		'assertion helper': function () {
			var dfd = this.async();

			cucumber1(function () {
				this.Given('step $step', function (value, callback) {
					// assert function should catch any exceptions in the test function and ensure `callback` is
					// called
					this.assert(callback, function () {
						if (value === '2') {
							throw new Error('fail');
						}
					});
				});
			}, feature);

			main.suites[0].tests[0].run().always(dfd.callback(function () {
				assert.strictEqual(main.suites[0].tests[0].numFailedTests, 1, 'One test should have failed');
			}));
		},

		'missing feature': function () {
			var dfd = this.async();
			require([ 'intern!cucumber!missing' ], dfd.callback(function (feature) {
				assert.instanceOf(feature, Error, 'require missing feature should resolve to error');
			}));
		}
	});
});
