define([ 'dojo-ts/topic' ], function (topic) {
	topic.subscribe('/suite/start', function (suite) {
		console.group(suite.name);
	});

	topic.subscribe('/suite/end', function (suite) {
		var numTests = suite.numTests,
			numFailedTests = suite.numFailedTests;

		console[numFailedTests ? 'warn' : 'info'](numTests - numFailedTests + '/' + numTests + ' tests passed');
		console.groupEnd();
	});

	topic.subscribe('/test/pass', function (test) {
		console.log('PASS:', test.name, '(' + test.timeElapsed + 'ms)');
	});

	topic.subscribe('/test/fail', function (test) {
		console.error('FAIL:', test.name, '(' + test.timeElapsed + 'ms)');
		console.error(test.error);
	});
});