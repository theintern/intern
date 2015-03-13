define([
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/text-summary',
	'dojo/node!istanbul/lib/report/text',
	'dojo/topic',
	'../util'
], function (Collector, Reporter, DetailedReporter, topic, util) {
	function Runner(config) {
		this.sessions = {};
		this.hasErrors = false;
		this.config = config || {};
		this.console = this.config.console;
	}

	Runner.prototype = {
		start: function () {
			this.reporter = new Reporter();
			this.detailedReporter = new DetailedReporter();
		},

		proxyStart: function (config) {
			this.console.log('Listening on 0.0.0.0:' + config.port);
		},

		deprecated: function (name, replacement, extra) {
			this.console.warn(name + ' is deprecated.' +
				(replacement ?
					' Use ' + replacement + ' instead.' :
					' Please open a ticket at https://github.com/theintern/intern/issues if you still require access ' +
					'to this command through the Command object.') +
				(extra ? ' ' + extra : '')
			);
		},

		testFail: function (test) {
			this.console.error('Test ' + test.id + ' FAILED');
			this.console.error(util.getErrorMessage(test.error));
		},

		fatalError: function (error) {
			this.console.error(util.getErrorMessage(error));
			this.hasErrors = true;
		},

		coverage: function (sessionId, coverage) {
			// coverage will be called for the runner host, which has no session ID -- ignore that
			if (sessionId) {
				var session = this.sessions[sessionId];
				session.coverage = session.coverage || new Collector();
				session.coverage.add(coverage);
			}
		},

		suiteStart: function (suite) {
			if (suite.environmentType && !suite.hasParent) {
				this.sessions[suite.sessionId] = suite;
				this.console.log('Created session ' + suite.environmentType + ' (' + suite.sessionId + ')');
			}
		},

		suiteEnd: function (suite) {
			if (suite.environmentType && !suite.hasParent) {
				if (!this.sessions[suite.sessionId]) {
					this.config.intern.proxyOnly ||
						this.console.warn('BUG: suiteEnd was received for invalid session ' + suite.sessionId);
					return;
				}

				var session = this.sessions[suite.sessionId];

				if (session.coverage) {
					this.reporter.writeReport(session.coverage);
				}
				else {
					this.console.log('No unit test coverage for ' + session.environmentType);
				}

				// TODO: Unit tests are reported but functional tests are not. The functional tests are reported in the
				// grand total, however.
				this.console.log(session.environmentType + ': ' + suite.numFailedTests + '/' + suite.numTests +
					' tests failed');
			}
		},

		suiteError: function (suite) {
			var error = suite.error;
			this.console.error('Suite ' + suite.id + ' FAILED');
			this.console.error(util.getErrorMessage(error));
			this.hasErrors = true;
		},

		stop: function () {
			var collector = new Collector();
			var numEnvironments = 0;
			var numTests = 0;
			var numFailedTests = 0;
			var numSkippedTests = 0;

			for (var k in this.sessions) {
				var session = this.sessions[k];
				session.coverage && collector.add(session.coverage.getFinalCoverage());

				if (k !== '') {
					++numEnvironments;
					numTests += session.numTests;
					numFailedTests += session.numFailedTests;
					numSkippedTests += session.numSkippedTests;
				}
			}

			// add a newline between test results and coverage results for prettier output
			this.console.log('');

			if (collector.files().length > 0) {
				this.detailedReporter.writeReport(collector);
			}

			var message = 'TOTAL: tested %d platforms, %d/%d tests failed';

			if (numSkippedTests) {
				message += ' (' + numSkippedTests + ' skipped)';
			}

			if (this.hasErrors && !numFailedTests) {
				message += '; fatal error occurred';
			}

			this.console.log(message, numEnvironments, numFailedTests, numTests);
		},

		tunnelStart: function () {
			this.console.log('Starting tunnel...');
		},

		tunnelStatus: function (tunnel, status) {
			this.console.log(status);
		}
	};

	return Runner;
});
