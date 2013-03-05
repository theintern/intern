define([ 'dojo-ts/topic' ], function (topic) {
	var hasGrouping = 'group' in console && 'groupEnd' in console;

	hasGrouping && topic.subscribe('/suite/start', function (suite) {
		if (suite.parent && suite.parent.name === 'main') {
			console.group(suite.name);
		}
	});

	topic.subscribe('/suite/end', function (suite) {
		if (suite.parent && suite.parent.name === 'main') {
			var numTests = suite.numTests,
				numFailedTests = suite.numFailedTests;

			console[numFailedTests ? 'warn' : 'info'](numTests - numFailedTests + '/' + numTests + ' tests passed');
			hasGrouping && console.groupEnd();
		}
	});

	topic.subscribe('/test/pass', function (test) {
		if (test.parent.parent && test.parent.parent.name === 'main') {
			console.log('PASS: ' + (hasGrouping ? test.name : test.id) + ' (' + test.timeElapsed + 'ms)');
		}
	});

	topic.subscribe('/test/fail', function (test) {
		if (test.parent.parent && test.parent.parent.name === 'main') {
			console.error('FAIL: ' + (hasGrouping ? test.name : test.id) + ' (' + test.timeElapsed + 'ms)');
			console.error(test.error.message);
			console.error(test.error.stack);
		}
	});
});