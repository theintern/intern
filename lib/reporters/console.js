define([
	'../util',
	'dojo/has',
	'dojo/has!host-node?dojo/node!istanbul/lib/collector',
	'dojo/has!host-node?dojo/node!istanbul/lib/report/text'
], function (util, has, Collector, Reporter) {
	if (typeof console !== 'object') {
		// IE<10 does not provide a global console object when Developer Tools is turned off
		return {};
	}

	var hasGrouping = 'group' in console && 'groupEnd' in console;

	var consoleReporter = {
		'/suite/start': hasGrouping ? function (suite) {
			console.group(suite.name);
		} : null,

		'/suite/end': function (suite) {
			var numTests = suite.numTests,
				numFailedTests = suite.numFailedTests,
				numSkippedTests = suite.numSkippedTests,
				message = numFailedTests + '/' + numTests + ' tests failed';
			if (numSkippedTests > 0) {
				message += ' (' + numSkippedTests + ' skipped)';
			}
			console[numFailedTests ? 'warn' : 'info'](message);
			hasGrouping && console.groupEnd(suite.name);
		},

		'/error': function (error) {
			console.warn('FATAL ERROR');
			util.logError(error);
		},

		'/test/pass': function (test) {
			console.log('PASS: ' + (hasGrouping ? test.name : test.id) + ' (' + test.timeElapsed + 'ms)');
		},

		'/test/skip': function (test) {
			console.log('SKIP: ' + (hasGrouping ? test.name : test.id) +
				(test.skipped ? ' (' + test.skipped + ')' : ''));
		},

		'/test/fail': function (test) {
			console.error('FAIL: ' + (hasGrouping ? test.name : test.id) + ' (' + test.timeElapsed + 'ms)');
			util.logError(test.error);
		}
	};

	if (has('host-node')) {
		consoleReporter['/coverage'] = function (sessionId, coverage) {
			var collector = new Collector();
			collector.add(coverage);

			// add a newline between test results and coverage results for prettier output
			console.log('');

			(new Reporter()).writeReport(collector, true);
		};
	}

	return consoleReporter;
});
