define([
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/text-summary',
	'../args',
	'../util'
], function (Collector, Reporter, args, util) {
	var sessions = {},
		reporter = new Reporter(),
		hasErrors = false;

	return {
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
					args.proxyOnly || console.warn('BUG: /suite/end was received for session ' + suite.sessionId + ' without a /session/start');
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
				console.log('No coverage report available');
			}

			// TODO: Unit tests are reported but functional tests are not. The functional tests are reported in the
			// grand total, however.
			console.log('%s: %d/%d tests failed', remote.environmentType, suite.numFailedTests, suite.numTests);
		},

		'/runner/end': function () {
			var collector = new Collector(),
				numEnvironments = 0,
				numTests = 0,
				numFailedTests = 0;

			for (var k in sessions) {
				var session = sessions[k];
				session.coverage && collector.add(session.coverage.getFinalCoverage());
				++numEnvironments;
				numTests += session.suite.numTests;
				numFailedTests += session.suite.numFailedTests;
			}

			reporter.writeReport(collector);

			var message = 'TOTAL: tested %d platforms, %d/%d tests failed';

			if (hasErrors && !numFailedTests) {
				message += '; fatal error occurred';
			}

			console.log(message, numEnvironments, numFailedTests, numTests);
		}
	};
});
