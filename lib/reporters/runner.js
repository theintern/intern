define([
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/text-summary',
	'dojo/node!istanbul/lib/report/text',
	'dojo/topic',
	'../args',
	'../util'
], function (Collector, Reporter, DetailedReporter, topic, args, util) {
	// empty session is for the test runner itself
	var sessions = { '': {} },
		reporter = new Reporter(),
		detailedReporter = new DetailedReporter(),
		hasErrors = false;

	return {
		'/proxy/start': function (config) {
			console.log('Listening on 0.0.0.0:' + config.port);
		},

		'/deprecated': function (name, replacement, extra) {
			console.warn(name + ' is deprecated.' +
				(replacement ?
					' Use ' + replacement + ' instead.' :
					' Please open a ticket at https://github.com/theintern/intern/issues if you still require access ' +
					'to this command through the Command object.') +
				(extra ? ' ' + extra : '')
			);
		},

		'/session/start': function (remote) {
			sessions[remote.sessionId] = { remote: remote };
			console.log('Initialised ' + remote.environmentType);
		},

		'/test/fail': function (test) {
			console.error('Test ' + test.id + ' FAILED on ' + sessions[test.sessionId].remote.environmentType + ':');
			util.logError(test.error);
		},

		'/error': function (error) {
			util.logError(error);
			hasErrors = true;
		},

		'/coverage': function (sessionId, coverage) {
			var session = sessions[sessionId];
			session.coverage = session.coverage || new Collector();
			session.coverage.add(coverage);
		},

		'/suite/end': function (suite) {
			if (suite.name === 'main') {
				if (!sessions[suite.sessionId]) {
					args.proxyOnly || console.warn('BUG: /suite/end was received for session ' + suite.sessionId +
						' without a /session/start');
					return;
				}

				sessions[suite.sessionId].suite = suite;
			}
		},

		'/session/end': function (remote) {
			var session = sessions[remote.sessionId],
				suite = session.suite;
			if (session.coverage) {
				reporter.writeReport(session.coverage);
			}
			else {
				console.log('No unit test coverage for ' + remote.environmentType);
			}

			// TODO: Unit tests are reported but functional tests are not. The functional tests are reported in the
			// grand total, however.
			console.log('%s: %d/%d tests failed', remote.environmentType, suite.numFailedTests, suite.numTests);
		},

		'/runner/end': function () {
			var collector = new Collector(),
				numEnvironments = 0,
				numTests = 0,
				numFailedTests = 0,
				numSkippedTests = 0;

			for (var k in sessions) {
				var session = sessions[k];
				session.coverage && collector.add(session.coverage.getFinalCoverage());

				if (k !== '') {
					++numEnvironments;
					numTests += session.suite.numTests;
					numFailedTests += session.suite.numFailedTests;
					numSkippedTests += session.suite.numSkippedTests;
				}
			}

			// add a newline between test results and coverage results for prettier output
			console.log('');

			if (collector.files().length > 0) {
				detailedReporter.writeReport(collector);
			}

			var message = 'TOTAL: tested %d platforms, %d/%d tests failed';

			if (numSkippedTests) {
				message += ' (' + numSkippedTests + ' skipped)';
			}

			if (hasErrors && !numFailedTests) {
				message += '; fatal error occurred';
			}

			console.log(message, numEnvironments, numFailedTests, numTests);
		},

		'/tunnel/start': function () {
			console.log('Starting tunnel...');
		},

		'/tunnel/status': function (tunnel, status) {
			console.log(status);
		}
	};
});
