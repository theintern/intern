define([
	'intern!object',
	'intern/chai!assert',
	'../../../../lib/Suite',
	'../../../../lib/Test',
	'../../../../lib/reporters/teamcity'
], function (registerSuite, assert, Suite, Test, reporter) {
	if (typeof console !== 'object') {
		// IE<10 does not provide a global console object when Developer Tools is turned off
		return;
	}

	function mockConsole(method, callback) {
		var oldMethod = console[method];
		console[method] = callback;
		return {
			remove: function () {
				console[method] = oldMethod;
			}
		};
	}

	var messagePatterns = {
		'/suite/start': '^##teamcity\\[testSuiteStarted name=\'{id}\'',
		'/suite/end': '^##teamcity\\[testSuiteFinished name=\'{id}\' duration=\'\\d+\'',
		'/test/start': '^##teamcity\\[testStarted name=\'{id}\'',
		'/test/skip': '^##teamcity\\[testIgnored name=\'{id}\'',
		'/test/end': '^##teamcity\\[testFinished name=\'{id}\' duration=\'\\d+\'',
		'/test/fail': '^##teamcity\\[testFailed name=\'{id}\' message=\'{message}\''
	};

	function testSuite(suite, topic, type) {
		var actualMessage,
			handle = mockConsole('log', function (message) {
				actualMessage = message;
			}),
			expected = messagePatterns[topic].replace('{id}', suite.id);

		try {
			reporter[topic](suite);
			assert.ok(actualMessage, 'console.log should be called when the reporter ' + topic + ' method is called');
			assert.match(
				actualMessage,
				new RegExp(expected),
				'console.log should be called with a ' + type + ' message');
		}
		finally {
			handle.remove();
		}
	}

	function testTest(test, topic, type) {
		var actualMessage,
			handle = mockConsole('log', function (message) {
				actualMessage = message;
			}),
			expected = messagePatterns[topic].replace('{id}', test.id);

		if (test.error) {
			expected = expected.replace('{message}', test.error.message);
		}

		try {
			reporter[topic](test);
			assert.ok(actualMessage, 'console.log should be called when the reporter ' + topic + ' method is called');
			assert.match(
				actualMessage,
				new RegExp(expected),
				'console.log should be called with a ' + type + ' message');
		}
		finally {
			handle.remove();
		}
	}

	registerSuite({
		name: 'intern/lib/reporters/teamcity',

		'/suite/start': function () {
			var suite = new Suite({ name: 'suite' });
			testSuite(suite, '/suite/start', 'testSuiteStarted');
		},

		'/suite/end': (function () {
			var suite = {
				'successful suite': function () {
					var suite = new Suite({ name: 'suite', tests: [ new Test({ hasPassed: true }) ] });
					reporter._suiteStarts[suite.id] = 0;
					testSuite(suite, '/suite/end', 'testSuiteFinished');
				},

				'failed suite': function () {
					var suite = new Suite({ name: 'suite', tests: [ new Test({ hasPassed: false }) ] });
					reporter._suiteStarts[suite.id] = 0;
					testSuite(suite, '/suite/end', 'testSuiteFinished');
				}
			};

			return suite;
		})(),

		'/test/start': function () {
			var test = new Test({
					name: 'test',
					timeElapsed: 123,
					parent: { name: 'parent', id: 'parent' },
					error: new Error('Oops')
				});
			testTest(test, '/test/start', 'testStarted');
		},

		'/test/skip': function () {
			var test = new Test({
					name: 'test',
					timeElapsed: 123,
					parent: { name: 'parent', id: 'parent' },
					error: new Error('Oops')
				});
			testTest(test, '/test/skip', 'testIgnored');
		},

		'/test/end': function () {
			var test = new Test({
					name: 'test',
					timeElapsed: 123,
					parent: { name: 'parent', id: 'parent' },
					error: new Error('Oops')
				});
			testTest(test, '/test/end', 'testFinished');
		},

		'/test/fail': function () {
			var test = new Test({
					name: 'test',
					timeElapsed: 123,
					parent: { name: 'parent', id: 'parent' },
					error: new Error('Oops')
				});
			testTest(test, '/test/fail', 'testFailed');
		}
	});
});
