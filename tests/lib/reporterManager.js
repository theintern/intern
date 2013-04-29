define([
	'intern!object',
	'intern/chai!assert',
	'../../lib/reporterManager',
	'dojo/topic'
], function (registerSuite, assert, reporterManager, topic) {
	registerSuite({
		name: 'intern/lib/reporterManager',

		'reporterManager#add / reporterManager#remove lifecycle': function () {
			var startCalled,
				topicCalled,
				firstStopCalled,
				secondStopCalled,
				thrownMessage,
				mockReporterHashA = { 'test': { stop: function () { firstStopCalled = true; } } },
				mockReporterHashB = {
					'test': {
						start: function () { startCalled = true; },
						'/some/topic': function () { topicCalled = true; },
						stop: function () { secondStopCalled = true; }
					}
				};

			reporterManager.add(mockReporterHashA);
			reporterManager.add(mockReporterHashB);
			assert.isTrue(firstStopCalled, 'Reporter should be stopped if new reporter is added with same ID');
			assert.isTrue(startCalled, 'Reporter should be started when it is added');

			topic.publish('/some/topic');
			assert.isTrue(topicCalled, 'Topic subscriptions based on reporter definition methods should be established when reporter is started');

			reporterManager.remove('test');
			assert.isTrue(secondStopCalled, 'Reporter should be stopped when it is removed');

			topic.publish('/some/topic');
			assert.isTrue(topicCalled, 'Topic subscriptions should be removed when reporter is removed');

			try {
				reporterManager.remove('testUnknownID');
			}
			catch (error) {
				thrownMessage = error.message;
			}

			assert.include(thrownMessage, 'testUnknownID', 'An error should be thrown with a message that contains the unknown reporter id');
		},

		'reporterManager#start': function () {
			var thrownMessage,
				countStartCalled = 0,
				mockReporter = {
					'test': {
						start: function () {
							countStartCalled++;
						}
					}
				};

			reporterManager.add(mockReporter);
			reporterManager.start('test');
			reporterManager.remove('test');
			assert.strictEqual(countStartCalled, 1, 'If a reporter is started, it should not be able to be started again.');

			try {
				reporterManager.start('testUnknownID');
			}
			catch (error) {
				thrownMessage = error.message;
			}

			assert.include(thrownMessage, 'testUnknownID', 'An error should be thrown with a message that contains the unknown reporter id');
		},

		'reporterManager#stop': function () {
			var thrownMessage,
				countStopCalled = 0,
				mockReporter = {
					'test': {
						stop: function () {
							countStopCalled++;
						}
					}
				};

			reporterManager.add(mockReporter);
			reporterManager.start('test');
			reporterManager.remove('test');
			assert.strictEqual(countStopCalled, 1, 'If a reporter is stopped, it should not be able to be stopped again.');

			try {
				reporterManager.stop('testUnknownID');
			}
			catch (error) {
				thrownMessage = error.message;
			}

			assert.include(thrownMessage, 'testUnknownID', 'An error should be thrown with a message that contains the unknown reporter id');
		}
	});
});