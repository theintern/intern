define([ 'dojo/topic' ], function (topic) {
	topic.subscribe('/suite/end', function (suite) {
		if (suite.name === 'main') {
			console.log('Tests complete');
			window.remoteTestCallback({
				results: suite.toJSON(),
				// At least WebDriver 2.28.0 will choke if it tries to serialise the code coverage structure itself
				coverageJson: JSON.stringify(window.__teststackCoverage)
			});
		}
	});
});