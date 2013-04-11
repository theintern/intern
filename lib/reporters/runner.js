define([
	'dojo-ts/topic',
	'dojo-ts/node!istanbul/lib/collector',
	'dojo-ts/node!istanbul/lib/report/text-summary',
	'../util'
], function (topic, Collector, Reporter, util) {
	var sessions = {},
		reporter = new Reporter(),
		hasErrors = false;

	topic.subscribe('/session/start', function (remote) {
		sessions[remote.sessionId] = { remote: remote };
		console.log('Initialised ' + remote.environmentType);
	});

	topic.subscribe('/test/fail', function (test) {
		console.error('Test ' + test.get('id') + ' FAILED on ' + sessions[test.get('sessionId')].remote.environmentType + ':');
		util.logError(test.error);
	});

	topic.subscribe('/error', function (error) {
		util.logError(error);
		hasErrors = true;
	});

	topic.subscribe('/coverage', function (sessionId, coverage) {
		var session = sessions[sessionId];
		session.coverage = session.coverage || new Collector();
		session.coverage.add(coverage);
	});

	topic.subscribe('/suite/end', function (suite) {
		if (suite.name === 'main') {
			sessions[suite.get('sessionId')].suite = suite;
		}
	});

	topic.subscribe('/session/end', function (remote) {
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
		console.log('%s: %d/%d tests failed', remote.environmentType, suite.get('numFailedTests'), suite.get('numTests'));
	});

	topic.subscribe('/runner/end', function () {
		var collector = new Collector(),
			numEnvironments = 0,
			numTests = 0,
			numFailedTests = 0;

		for (var k in sessions) {
			var session = sessions[k];
			session.coverage && collector.add(session.coverage.getFinalCoverage());
			++numEnvironments;
			numTests += session.suite.get('numTests');
			numFailedTests += session.suite.get('numFailedTests');
		}

		reporter.writeReport(collector);

		var message = 'TOTAL: tested %d platforms, %d/%d tests failed';

		if (hasErrors && !numFailedTests) {
			message += '; fatal error occurred';
		}

		console.log(message, numEnvironments, numFailedTests, numTests);
	});
});
