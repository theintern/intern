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

	function secsToMs(number) {
		return (number * 1000).toFixed(2);
	}

	var consoleReporter = {
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
		},

		'/bench/start': hasGrouping ? function (bench) {
			console.group(bench.name);
		} : function (bench) {
			console.log('START: ' + bench.id);
		},

		'/bench/cycle': function (bench) {
			var test = bench.event.target;
			if (hasGrouping) {
				console.group(test.name);
			}
			else {
				console.log(bench.id + ' - ' + test.name);
			}
			if (bench.type === 'benchmark' || bench.type === 'baseline') {
				console.log('Operations/Sec: ' + test.hz.toFixed(test.hz < 100 ? 2 : 0));
				console.log('Relative Margin of Error: \xb1' + test.stats.rme.toFixed(2) + '%');
				console.log('Samples: ' + test.stats.sample.length);
				if (bench.type === 'baseline') {
					console.log('Mean: ' + secsToMs(test.stats.mean) + 'ms');
					console.log('Deviation: \xb1' + secsToMs(test.stats.deviation) + 'ms');
					console.log('Variance: \xb1' + secsToMs(test.stats.variance) + 'ms');
					console.log('Margin of Error: \xb1' + secsToMs(test.stats.moe) + 'ms');
					console.log('Standard Error of Mean: \xb1' + secsToMs(test.stats.sem) + 'ms');
					console.log('Cycle Time: ' + secsToMs(test.times.cycle) + 'ms');
				}
			}
			hasGrouping && console.groupEnd();
		},

		'/bench/end': function (bench) {
			var numTests = bench.numTests,
			numFailedTests = bench.numFailedTests;

			if (bench.type === 'benchmark') {
				var fastest = bench.suite.filter('fastest').pluck('name'),
					slowest = bench.suite.filter('slowest').pluck('name');
				console[numFailedTests ? 'warn' : 'info']('Fastest: "' + fastest + '" Slowest: "' + slowest + '" - ' +
					(numTests - numFailedTests) + '/' + numTests + ' tests completed');
			}
			else {
				var times = bench.event.target.times;
				console.log('Elapsed: ' + times.elapsed + ' secs');
				console[numFailedTests ? 'warn' : 'info']((numTests - numFailedTests) + '/' + numTests + ' tests completed');
			}
			hasGrouping && console.groupEnd();
		},

		'/bench/error': function (bench) {
			var test = (bench.event && bench.event.target) || null;
			if (test && test.error) {
				console.error('ERROR: ' + (hasGrouping ? test.name : bench.id + ' - ' + test.name));
				console.error(test.error.message);
				console.error(test.error.stack);
			}
			else {
				console.error('ERROR: ' + bench.id);
				console.error(bench.error.message);
				console.error(bench.error.stack);
			}
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
