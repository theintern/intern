define([
	'intern!object',
	'intern/chai!assert',
	'../../lib/reporterManager',
	'dojo/topic'
], function (registerSuite, assert, reporterManager, topic) {
	registerSuite({
		name: 'intern/lib/reporterManager',

		beforeEach: function () {
			try {
				reporterManager.remove('test');
			}
			catch (error) {}
		},

		'add/remove lifecycle': function () {
			var actual = [],
				expected = [];

			reporterManager.add({
				'test': {
					start: function () {
						actual.push('start1');
					},
					'/some/topic': function () {
						actual.push('topic1');
					},
					stop: function () {
						actual.push('stop1');
					}
				}
			});

			expected.push('start1');
			assert.deepEqual(actual, expected, 'Reporter should be started automatically when added (start test)');

			topic.publish('/some/topic');
			expected.push('topic1');
			assert.deepEqual(actual, expected, 'Reporter should be started automatically when added (topic test)');

			reporterManager.add({
				'test': {
					start: function () {
						actual.push('start2');
					},
					'/some/topic': function () {
						actual.push('topic2');
					},
					stop: function () {
						actual.push('stop2');
					}
				}
			});
			expected.push('stop1', 'start2');

			assert.deepEqual(actual, expected, 'Old reporter should be implicitly removed if new reporter is added with same ID');

			topic.publish('/some/topic');
			expected.push('topic2');
			assert.deepEqual(actual, expected, 'Old reporter should no longer be responding to topics; the new one should');

			reporterManager.remove('test');
			expected.push('stop2');
			assert.deepEqual(actual, expected, 'Reporter should be stopped when it is explicitly removed');

			topic.publish('/some/topic');
			assert.deepEqual(actual, expected, 'Reporter should not respond to topics once it has been removed');

			var removeError;
			try {
				reporterManager.remove('test');
			}
			catch (error) {
				removeError = error;
			}

			if (!removeError) {
				throw new assert.AssertionError({ message: 'Remove should throw when passed a reporter ID that is not registered' });
			}

			assert.match(removeError.message, /\btest\b/, 'The error thrown when removing a non-existent reporter should contain the unknown reporter ID');
		},

		'start/stop lifecycle': function () {
			var numTimesStarted = 0,
				numTimesStopped = 0;

			reporterManager.add({
				'test': {
					start: function () {
						++numTimesStarted;
					},
					stop: function () {
						++numTimesStopped;
					}
				}
			});

			reporterManager.start('test');
			reporterManager.start('test');
			assert.strictEqual(numTimesStarted, 1, 'Trying to start an already-started reporter should do nothing');

			reporterManager.stop('test');
			reporterManager.stop('test');
			reporterManager.remove('test');
			assert.strictEqual(numTimesStopped, 1, 'Trying to stop an already-stopped reporter should do nothing');
		}
	});
});
