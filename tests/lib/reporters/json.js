define([
	'intern!object',
	'intern/chai!assert',
	'dojo/lang',
	'../../../lib/Suite',
	'../../../lib/Test',
	'../../../lib/reporters/json'
], function (registerSuite, assert, lang, Suite, Test, reporter) {
	var consoleLog = console.log;

	if (typeof console !== 'object') {
		// IE<10 does not provide a global console object when Developer Tools is turned off
		return;
	}

	function parseMessage(message) {
		try {
			return JSON.parse(message);
		} catch (e) {
			return e;
		}
	}

	function runWithMockConsole(callback) {
		var messages = [];

		console.log = function (msg) {
			messages.push(parseMessage(msg));
		};

		try {
			callback();
		}
		finally {
			console.log = consoleLog;
		}

		return messages;
	}

	function testReporterTopic(topic, argument) {
		var messages = runWithMockConsole(function () {
			reporter.start();
			try {
				reporter[topic](argument);
			}
			finally {
				reporter.remove();
			}
		});
		assert.strictEqual(messages.length, 1, '1 message should have been logged');
		assert.strictEqual(messages[0].topic, topic, 'Message should have expected topic property');
	}

	registerSuite({
		name: 'intern/lib/reporters/json',

		'/suite/start': function () {
			var suite = new Suite({ name: 'suite' });
			testReporterTopic('/suite/start', suite);
		},

		'/suite/end': function () {
			var suite = new Suite({
				name: 'suite',
				tests: [ new Test({ hasPassed: true }) ]
			});
			testReporterTopic('/suite/end', suite);
		},

		'/suite/error': (function () {
			return {
				'error': function () {
					var suite = new Suite({ name: 'suite', error: new Error('Oops') });
					testReporterTopic('/suite/error', suite);
				},

				'no error': function () {
					var suite = new Suite({ name: 'suite' });
					testReporterTopic('/suite/error', suite);
				}
			};
		})(),

		'/test/pass': function () {
			var test = new Test({
					name: 'test',
					hasPassed: true
				});
			testReporterTopic('/test/pass', test);
		},

		'/test/fail': (function () {
			return {
				'error': function () {
					var test = new Test({ name: 'test', error: new Error('Oops') });
					testReporterTopic('/test/fail', test);
				},

				'no error': function () {
					var test = new Test({ name: 'test' });
					testReporterTopic('/test/fail', test);
				}
			};
		})(),

		'/test/end': (function () {
			return {
				'no error': function () {
					var test = new Test({ name: 'test' });
					testReporterTopic('/test/end', test);
				},

				'error': function () {
					var test = new Test({
							name: 'test',
							error: new Error('Oops')
						});
					testReporterTopic('/test/end', test);
				}
			};
		})(),

		'/session/start': function () {
			var remote = { environmentType: 'test' };
			testReporterTopic('/session/start', remote);
		},

		'/session/end': function () {
			var remote = { environmentType: 'test' };
			testReporterTopic('/session/end', remote);
		},

		'/error': (function () {
			return {
				'stack': function () {
					testReporterTopic('/error', { stack: 'trace' });
				},

				'no stack': function () {
					testReporterTopic('/error', {});
				}
			};
		})()
	});
});

