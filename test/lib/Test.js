define([
	'teststack!object',
	'teststack/chai!assert',
	'../../lib/Test',
	'dojo-ts/topic'
], function (registerSuite, assert, Test, topic) {
	registerSuite({
		name: 'teststack/lib/Test',

		'Test#hasPassed': function () {
			var dfd = this.async(null, 2),
				thrownError = new Error('Oops'),
				goodTest = new Test({ test: function () {} }),
				badTest = new Test({ test: function () { throw thrownError; } });

			assert.isFalse(goodTest.hasPassed, 'Good test should not have passed if it has not been executed');
			assert.isFalse(badTest.hasPassed, 'Bad test should not have passed if it has not been executed');
			goodTest.run().always(dfd.callback(function () {
				assert.isTrue(goodTest.hasPassed, 'Good test should have passed after execution without error');
			}));
			badTest.run().always(dfd.callback(function () {
				assert.isFalse(badTest.hasPassed, 'Bad test should not have passed after execution with error');
				assert.strictEqual(badTest.error, thrownError, 'Bad test error should be the error which was thrown');
			}));
		},

		'Test#constructor topic': function () {
			var topicFired = false,
				actualTest,
				handle = topic.subscribe('/test/new', function (test) {
					topicFired = true;
					actualTest = test;
				});

			try {
				var expectedTest = new Test({});
				assert.isTrue(topicFired, '/test/new topic should fire after a test is created');
				assert.strictEqual(actualTest, expectedTest, '/test/new topic should be passed the test that was just created');
			}
			finally {
				handle.remove();
			}
		}
	});
});