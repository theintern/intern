define([
	'intern!object',
	'intern/chai!assert',
	'../../../lib/ReporterManager'
], function (registerSuite, assert, ReporterManager) {
	registerSuite({
		name: 'intern/lib/ReporterManager',

		'add/remove legacy reporter': function () {
			var actual = [];
			var expected = [];
			var reporterManager = new ReporterManager();

			// legacy reporter
			var handle = reporterManager.add({
				'/some/topic': function () {
					actual.push('topic1');
				},
				stop: function () {
					actual.push('stopped');
				}
			});

			reporterManager.emit('someTopic');
			expected.push('topic1');
			assert.deepEqual(actual, expected, 'Reporter should respond to topics automatically when added');

			handle.remove();
			expected.push('stopped');
			assert.deepEqual(actual, expected, 'Reporter should be stopped when it is removed');

			reporterManager.emit('someTopic');
			assert.deepEqual(actual, expected, 'Reporter should not respond to topics once it has been removed');

			assert.doesNotThrow(function () {
				handle.remove();
			}, Error, 'Removing an removed reporter should not throw');
		},

		'add/remove Reporter': function () {
			function MockReporter() {
				actual.push('created');
			}

			MockReporter.prototype = {
				someTopic: function () {
					actual.push('topic1');
				},
				destroy: function () {
					actual.push('stopped');
				}
			};

			var actual = [];
			var expected = [];
			var reporterManager = new ReporterManager();
			var handle;

			expected.push('created');
			handle = reporterManager.add(MockReporter, { option: 'foo' });
			assert.deepEqual(actual, expected, 'Reporter instance should have been instantiated');

			reporterManager.emit('someTopic');
			expected.push('topic1');
			assert.deepEqual(actual, expected, 'Reporter should respond to topics automatically when added');

			handle.remove();
			expected.push('stopped');
			assert.deepEqual(actual, expected, 'Reporter should be stopped when it is removed');

			reporterManager.emit('someTopic');
			assert.deepEqual(actual, expected, 'Reporter should not respond to topics after removal');

			assert.doesNotThrow(function () {
				handle.remove();
			}, Error, 'Removing an removed reporter should not throw');
		}
	});
});
