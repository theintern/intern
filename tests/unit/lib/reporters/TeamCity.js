define([
	'intern!object',
	'intern/chai!assert',
	'./support/MockStream',
	'../../../../lib/Suite',
	'../../../../lib/Test',
	'../../../../lib/reporters/TeamCity',
	'../../../../lib/util'
], function (registerSuite, assert, MockStream, Suite, Test, TeamCity, util) {
	var messagePatterns = {
		suiteStart: '^##teamcity\\[testSuiteStarted name=\'{name}\'',
		suiteEnd: '^##teamcity\\[testSuiteFinished name=\'{name}\' duration=\'\\d+\'',
		testStart: '^##teamcity\\[testStarted name=\'{name}\'',
		testSkip: '^##teamcity\\[testIgnored name=\'{name}\'',
		testEnd: '^##teamcity\\[testFinished name=\'{name}\' duration=\'\\d+\'',
		testFail: '^##teamcity\\[testFailed name=\'{name}\' message=\'{message}\''
	};

	function testSuite(suite, topic, type) {
		var output = new MockStream();
		var reporter = new TeamCity({ output: output });
		var expected = messagePatterns[topic].replace('{name}', suite.name);

		reporter[topic](suite);
		assert.ok(output.data, 'Data should be output when the reporter ' + topic + ' method is called');
		assert.match(
			output.data,
			new RegExp(expected),
			'Output data for ' + type + ' message should match expected message pattern');
	}

	function testTest(test, topic, type) {
		var output = new MockStream();
		var reporter = new TeamCity({ output: output });
		var expected = messagePatterns[topic].replace('{name}', test.name);

		if (test.error) {
			// n.b., only the `testFail` messagePattern has a `{message}` placeholder
			var errorMessage = reporter._escapeString(util.getErrorMessage(test.error));
			expected = expected.replace('{message}', errorMessage);
		}

		reporter[topic](test);
		assert.ok(output.data, 'Data should be output when the reporter ' + topic + ' method is called');
		assert.match(
			output.data,
			new RegExp(expected),
			'Output data for ' + type + ' should match expected message pattern');
	}

	registerSuite({
		name: 'intern/lib/reporters/TeamCity',

		suiteStart: function () {
			var suite = new Suite({ name: 'suite', parent: true });
			testSuite(suite, 'suiteStart', 'testSuiteStarted');
		},

		suiteEnd: {
			'successful suite': function () {
				var suite = new Suite({ name: 'suite', parent: true, timeElapsed: 123, tests: [ new Test({ hasPassed: true }) ] });
				testSuite(suite, 'suiteEnd', 'testSuiteFinished');
			},

			'failed suite': function () {
				var suite = new Suite({ name: 'suite', parent: true, timeElapsed: 123, tests: [ new Test({ hasPassed: false }) ] });
				testSuite(suite, 'suiteEnd', 'testSuiteFinished');
			}
		},

		testStart: function () {
			var test = new Test({
				name: 'test',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				error: new Error('Oops')
			});
			testTest(test, 'testStart', 'testStarted');
		},

		testSkip: function () {
			var test = new Test({
				name: 'test',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				error: new Error('Oops')
			});
			testTest(test, 'testSkip', 'testIgnored');
		},

		testEnd: function () {
			var test = new Test({
				name: 'test',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				error: new Error('Oops')
			});
			testTest(test, 'testEnd', 'testFinished');
		},

		testFail: function () {
			var test = new Test({
				name: 'test',
				timeElapsed: 123,
				parent: { name: 'parent', id: 'parent' },
				error: new Error('Oops')
			});
			testTest(test, 'testFail', 'testFailed');
		}
	});
});
