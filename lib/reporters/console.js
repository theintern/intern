define([
	'../util'
], function (util) {
	if (typeof console !== 'object') {
		// IE<10 does not provide a global console object when Developer Tools is turned off
		return {};
	}

	var hasGrouping = 'group' in console && 'groupEnd' in console;

	return {
		'/suite/start': hasGrouping ? function (suite) {
			console.group(suite.name);
		} : null,

		'/suite/end': function (suite) {
			var numTests = suite.numTests,
				numFailedTests = suite.numFailedTests;
			console[numFailedTests ? 'warn' : 'info'](numTests - numFailedTests + '/' + numTests + ' tests passed');
			hasGrouping && console.groupEnd(suite.name);
		},

		'/suite/error': function (suite) {
			console.warn('SUITE ERROR: in ' + suite.id);
			util.logError(suite.error);
			if (suite.error.relatedTest) {
				console.error('Related test: ' + (hasGrouping ? suite.error.relatedTest.name : suite.error.relatedTest.id));
			}
		},

		'/test/pass': function (test) {
			console.log('PASS: ' + (hasGrouping ? test.name : test.id) + ' (' + test.timeElapsed + 'ms)');
		},

		'/test/fail': function (test) {
			console.error('FAIL: ' + (hasGrouping ? test.name : test.id) + ' (' + test.timeElapsed + 'ms)');
			util.logError(test.error);
		}
	};
});
