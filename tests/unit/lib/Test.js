define([
	'intern!object',
	'intern/chai!assert',
	'../../../lib/Test',
	'../../../lib/Suite',
	'dojo/Promise'
], function (registerSuite, assert, Test, Suite, Promise) {
	function createTest(options) {
		if (!options.parent) {
			options.parent = {
				reporterManager: {
					emit: options.reporterManagerEmit || function () {}
				}
			};
		}
		return new Test(options);
	}

	registerSuite({
		name: 'intern/lib/Test',

		'Test#test': function () {
			var dfd = this.async(250);
			var executed = false;

			var test = new Test({
				test: function () {
					executed = true;
				}
			});

			test.run().then(dfd.callback(function () {
				assert.isTrue(executed, 'Test function should be called when run is called');
			}));
		},

		'Test#test throws': function () {
			var dfd = this.async(250);
			var thrownError = new Error('Oops');
			var test = new Test({
				test: function () {
					throw thrownError;
				}
			});

			test.run().then(function () {
				dfd.reject(new assert.AssertionError({ message: 'Test should not resolve when it throws an error' }));
			}, dfd.callback(function (error) {
				assert.strictEqual(test.error, thrownError, 'Error thrown by test should be the error set on test');
				assert.strictEqual(error, thrownError, 'Error thrown by test should be the error used by the promise');
			}));
		},

		'Test#async implicit': function () {
			var dfd = this.async();
			var resolved = false;
			var test = new Test({
				test: function () {
					var dfd = this.async(250);
					setTimeout(function () {
						resolved = true;
						dfd.resolve();
					}, 0);
				}
			});

			test.run().then(dfd.callback(function () {
				assert.isTrue(resolved, 'Test promise should have been resolved by the asynchronous code in the test');
			}),
			function () {
				dfd.reject(new assert.AssertionError({ message:
					'Test promise should resolve successfully, without any timeout' }));
			});

			assert.isFalse(resolved, 'Test promise should not resolve immediately after calling run');
		},

		'Test#async explicit': function () {
			var dfd = this.async();
			var resolved = false;
			var test = new Test({
				test: function () {
					var dfd = new Promise.Deferred();
					setTimeout(function () {
						resolved = true;
						dfd.resolve();
					}, 0);
					return dfd.promise;
				}
			});

			test.run().then(dfd.callback(function () {
				assert.isTrue(resolved, 'Test promise should have been resolved by the asynchronous code in the test');
			}),
			function () {
				dfd.reject(new assert.AssertionError({
					message: 'Test promise should resolve successfully, without any timeout'
				}));
			});

			assert.isFalse(resolved, 'Test promise should not resolve immediately after calling run');
		},

		'Test#async callback + numCallsUntilResolution': function () {
			var dfd = this.async();
			var numCalls = 0;
			var test = new Test({
				test: function () {
					var dfd = this.async(250, 3);

					for (var i = 0; i < 3; ++i) {
						dfd.callback(function () {
							++numCalls;
						})();
					}
				}
			});

			test.run().then(function () {
				assert.strictEqual(numCalls, 3,
					'Callback method should have been invoked three times before test completed');
				dfd.resolve();
			},
			function () {
				dfd.reject(new assert.AssertionError({
					message: 'Test should pass if specified number of callbacks are triggered on the promise'
				}));
			});
		},

		'Test#async -> timeout': function () {
			var dfd = this.async(500);
			var test = new Test({
				test: function () {
					this.async(250);
				}
			});

			test.run().then(function () {
				dfd.reject(new Error('Test should timeout if async and the promise is never resolved'));
			},
			function (error) {
				assert.ok(error, 'Timeout error thrown in async test');
				dfd.resolve();
			});
		},

		'Test#async -> reject': function () {
			var dfd = this.async(250);
			var thrownError = new Error('Oops');

			var test = new Test({
				test: function () {
					var d = this.async(250);
					d.reject(thrownError);
				}
			});

			test.run().then(function () {
				dfd.reject(new assert.AssertionError({
					message: 'Test should throw if async and the promise is rejected'
				}));
			},
			function (error) {
				assert.strictEqual(test.error, error, 'Error thrown in test should equal our assertion error');
				assert.strictEqual(error, thrownError, 'Error thrown in test should be the error used by the promise');
				dfd.resolve();
			});
		},

		'Test#timeElapsed': function () {
			var test = new Test({
				test: function () {
					var dfd = this.async();
					setTimeout(function () {
						dfd.resolve();
					}, 100);
				}
			});

			return test.run().then(function () {
				// It isn't really our job to test how accurate browsers are, and this test will randomly fail
				// when a browser decides to be slow for no reason (or execute setTimeout too fast for no reason)
				// so we need to be really lax with this check
				assert.typeOf(test.timeElapsed, 'number', 'Test time elapsed should be a number');
				assert(test.timeElapsed > 0,
					'Test time elapsed for 100ms async test should be greater than zero milliseconds');
			});
		},

		'Test#toJSON': function () {
			var test = new Test({
				name: 'test name',
				parent: {
					id: 'parent id',
					name: 'parent id',
					sessionId: 'abcd'
				},
				test: function () {}
			});
			var expected = {
				error: null,
				id: 'parent id - test name',
				name: 'test name',
				sessionId: 'abcd',
				timeElapsed: 100,
				timeout: 30000,
				hasPassed: true,
				skipped: null
			};

			return test.run().then(function () {
				// Elapsed time is non-deterministic, so just force it to a value we can test
				test.timeElapsed = 100;

				assert.deepEqual(test.toJSON(), expected,
					'Test#toJSON should return expected JSON structure for test with no error');

				test.error = expected.error = { name: 'Oops', message: 'message', stack: 'stack' };
				assert.deepEqual(test.toJSON(), expected,
					'Test#toJSON should return expected JSON structure for test with error');
			});
		},

		'Test#hasPassed': function () {
			var dfd = this.async(null, 2);
			var thrownError = new Error('Oops');
			var goodTest = new Test({ test: function () {} });
			var badTest = new Test({ test: function () {
				throw thrownError;
			} });

			assert.isFalse(goodTest.hasPassed, 'Good test should not have passed if it has not been executed');
			assert.isFalse(badTest.hasPassed, 'Bad test should not have passed if it has not been executed');
			goodTest.run().finally(dfd.callback(function () {
				assert.isTrue(goodTest.hasPassed, 'Good test should have passed after execution without error');
			}));
			badTest.run().finally(dfd.callback(function () {
				assert.isFalse(badTest.hasPassed, 'Bad test should not have passed after execution with error');
				assert.strictEqual(badTest.error, thrownError, 'Bad test error should be the error which was thrown');
			}));
		},

		'Test#constructor topic': function () {
			var topicFired = false;
			var actualTest;
			var expectedTest = createTest({
				reporterManagerEmit: function (topic, test) {
					if (topic === 'newTest') {
						topicFired = true;
						actualTest = test;
					}
				}
			});
			assert.isTrue(topicFired, 'newTest topic should fire after a test is created');
			assert.strictEqual(actualTest, expectedTest,
				'newTest topic should be passed the test that was just created');
		},

		'Test#sessionId': function () {
			var test = new Test({
				parent: new Suite({ sessionId: 'parent' })
			});
			assert.strictEqual(test.sessionId, test.parent.sessionId,
				'Test#sessionId should get the sessionId from the test\'s parent');
		},

		'Test#remote': function () {
			var mockRemote = { sessionId: 'test' };
			var test = new Test({
				parent: new Suite({ remote: mockRemote })
			});
			assert.strictEqual(test.remote, mockRemote,
				'Test#remote should get the remote value from from the test\'s parent');
		},

		'Test#skip': function () {
			var actualTests = {};
			var expectedTests = {};
			var dfd = this.async();

			// setting the skipped property on a test should cause it to be skipped
			expectedTests.first = createTest({
				reporterManagerEmit: function (topic, test) {
					if (topic === 'testSkip') {
						actualTests.first = test;
					}
				}
			});
			expectedTests.first.skipped = 'reason';
			expectedTests.first.run().finally(dfd.callback(function () {
				assert.property(actualTests, 'first', 'testSkip topic should fire when a test is skipped');
				assert.strictEqual(actualTests.first, expectedTests.first,
					'testSkip topic should be passed the test that was skipped');
				assert.propertyVal(actualTests.first, 'skipped', 'reason',
					'test should have `skipped` property with expected value');
			}));

			// calling skip from within a test should cause it to be skipped
			expectedTests.second = createTest({
				test: function () {
					this.skip('skipping');
				},
				reporterManagerEmit: function (topic, test) {
					if (topic === 'testSkip') {
						if (topic === 'testSkip') {
							actualTests.second = test;
						}
					}
				}
			});
			expectedTests.second.run().finally(dfd.callback(function () {
				assert.property(actualTests, 'second', 'testSkip topic should fire when a test is skipped');
				assert.strictEqual(actualTests.second, expectedTests.second,
					'testSkip topic should be passed the test that was skipped');
				assert.propertyVal(actualTests.second, 'skipped', 'reason',
					'test should have `skipped` property with expected value');
			}));
		}
	});
});
