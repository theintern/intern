define([
	'dojo-ts/topic',
	'../util'
], function (topic, util) {
	var hasGrouping = 'group' in console && 'groupEnd' in console;

	hasGrouping && topic.subscribe('/suite/start', function (suite) {
		console.group(suite.name);
	});

	topic.subscribe('/suite/end', function (suite) {
		var numTests = suite.get('numTests'),
			numFailedTests = suite.get('numFailedTests');

		console[numFailedTests ? 'warn' : 'info'](numTests - numFailedTests + '/' + numTests + ' tests passed');
		hasGrouping && console.groupEnd();
	});

	topic.subscribe('/suite/error', function (suite) {
		console.warn('SUITE ERROR: in ' + suite.get('id'));
		util.logError(suite.error);
		if (suite.error.relatedTest) {
			console.error('Related test: ' + hasGrouping ? suite.error.relatedTest.name : suite.error.relatedTest.get('id'));
		}
	});

	topic.subscribe('/test/pass', function (test) {
		console.log('PASS: ' + (hasGrouping ? test.name : test.get('id')) + ' (' + test.timeElapsed + 'ms)');
	});

	topic.subscribe('/test/fail', function (test) {
		console.error('FAIL: ' + (hasGrouping ? test.name : test.get('id')) + ' (' + test.timeElapsed + 'ms)');
		util.logError(test.error);
	});
});
