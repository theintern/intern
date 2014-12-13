define([
	'../util',
	'dojo/has',
	'dojo/has!host-node?dojo/node!istanbul/lib/collector',
	'dojo/has!host-node?dojo/node!istanbul/lib/report/text'
], function (util, has, Collector, Reporter) {
	/**
	 * The console reporter outputs to the current environment's console.
	 */
	function Console(config) {
		this.console = config.console;
		this.hasGrouping = 'group' in this.console && 'groupEnd' in this.console;
		this.testId = this.hasGrouping ? 'name' : 'id';
	}

	Console.prototype = {
		suiteStart: function (suite) {
			this.hasGrouping && this.console.group(suite.name);
		},

		suiteEnd: function (suite) {
			// IE<10 does not provide a global console object when Developer Tools is turned off
			if (!this.console) {
				return;
			}

			var numTests = suite.numTests;
			var numFailedTests = suite.numFailedTests;
			var numSkippedTests = suite.numSkippedTests;
			var message = numFailedTests + '/' + numTests + ' tests failed';

			if (numSkippedTests > 0) {
				message += ' (' + numSkippedTests + ' skipped)';
			}

			this.console[numFailedTests ? 'warn' : 'info'](message);
			this.hasGrouping && this.console.groupEnd(suite.name);
		},

		suiteError: function (suite) {
			if (!this.console) {
				return;
			}
			this.console.warn('SUITE ERROR');
			this.console.error(util.getErrorMessage(suite.error));
		},

		fatalError: function (error) {
			this.console.warn('FATAL ERROR');
			this.console.error(util.getErrorMessage(error));
		},

		testPass: function (test) {
			this.console.log('PASS: ' + test[this.testId] + ' (' + test.timeElapsed + 'ms)');
		},

		testSkip: function (test) {
			this.console.log('SKIP: ' + test[this.testId] + (test.skipped ? ' (' + test.skipped + ')' : ''));
		},

		testFail: function (test) {
			this.console.error('FAIL: ' + test[this.testId] + ' (' + test.timeElapsed + 'ms)');
			this.console.error(util.getErrorMessage(test.error));
		}
	};

	if (has('host-node')) {
		Console.prototype.coverage = function (sessionId, coverage) {
			if (!this.console) {
				return;
			}

			var collector = new Collector();
			collector.add(coverage);

			// add a newline between test results and coverage results for prettier output
			this.console.log('');

			(new Reporter()).writeReport(collector, true);
		};
	}

	return Console;
});
