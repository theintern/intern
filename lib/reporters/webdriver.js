define([ 'dojo/topic' ], function (topic) {
	topic.subscribe('/suite/end', function (suite) {
		if (suite.name === 'main') {
			console.log('Tests complete');
			// WebDriver 2.28.0 will choke if it tries to serialise certain structures itself, so just stringify
			// everything
			window.remoteTestCallback(JSON.stringify({
				suite: suite.toJSON(),
				coverage: window.__teststackCoverage
			}));
		}
	});
});