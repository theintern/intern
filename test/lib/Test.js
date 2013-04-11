define([
	'teststack!object',
	'teststack/chai!assert',
	'../../lib/Test',
	'dojo-ts/topic'
], function (registerSuite, assert, Test, topic) {
	registerSuite({
		name: 'teststack/lib/Test',

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