define([
	'dojo-ts/topic',
	'dojo-ts/node!istanbul/lib/collector',
	'dojo-ts/node!istanbul/lib/report/text-summary'
], function (topic, Collector, Reporter) {
	var sessions = {},
		reporter = new Reporter();

	topic.subscribe('/session/start', function (environment) {
		sessions[environment.sessionId] = { environment: environment };
		console.log('Initialised ' + environment.type);
	});

	topic.subscribe('/test/fail', function (sessionId, test) {
		console.error('Test ' + test.id + ' FAILED on ' + sessions[sessionId].environment.type + ':\n' + test.error.stack || test.error);
	});

	topic.subscribe('/error', function (error) {
		console.error(error.stack || error);
	});

	topic.subscribe('/coverage', function (sessionId, coverage) {
		sessions[sessionId].coverage = coverage;
	});

	topic.subscribe('/suite/end', function (sessionId, suite) {
		if (suite.name === 'main') {
			sessions[sessionId].suite = suite;
		}
	});

	topic.subscribe('/session/end', function (environment) {
		var session = sessions[environment.sessionId],
			suite = session.suite,
			collector = new Collector();

		collector.add(session.coverage);

		reporter.writeReport(collector);
		console.log('%s: %d/%d tests failed', environment.type, suite.numFailedTests, suite.numTests);
	});

	topic.subscribe('/runner/end', function () {
		var collector = new Collector(),
			numEnvironments = 0,
			numTests = 0,
			numFailedTests = 0;

		for (var k in sessions) {
			var session = sessions[k];
			session.coverage && collector.add(session.coverage);
			++numEnvironments;
			numTests += session.suite.numTests;
			numFailedTests += session.suite.numFailedTests;
		}

		reporter.writeReport(collector);
		console.log('TOTAL: tested %d platforms, %d/%d tests failed', numEnvironments, numFailedTests, numTests);
	});
});