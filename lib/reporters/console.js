define([ 'dojo-ts/topic' ], function (topic) {
	var hasGrouping = 'group' in console && 'groupEnd' in console;

	hasGrouping && topic.subscribe('/suite/start', function (suite) {
		console.group(suite.name);
	});

	topic.subscribe('/suite/end', function (suite) {
		var numTests = suite.numTests,
			numFailedTests = suite.numFailedTests;

		console[numFailedTests ? 'warn' : 'info'](numTests - numFailedTests + '/' + numTests + ' tests passed');
		hasGrouping && console.groupEnd();
	});

	topic.subscribe('/test/pass', function (test) {
		console.log('PASS: ' + (hasGrouping ? test.name : test.id) + ' (' + test.timeElapsed + 'ms)');
	});

	topic.subscribe('/test/fail', function (test) {
		console.error('FAIL: ' + (hasGrouping ? test.name : test.id) + ' (' + test.timeElapsed + 'ms)');
		console.error(test.error.message + '\n' +
			// V8 puts the original error at the top of the stack too; avoid redundant output that may cause confusion
			// about how many times an assertion was actually called
			test.error.stack.slice(0, test.error.message.length) === test.error.message.length ?
			test.error.stack.slice(test.error.message.length) :
			test.error.stack
		);
	});
});