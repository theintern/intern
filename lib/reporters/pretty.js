define([
	'intern',
	'dojo/has',
	'./pretty/PTYView',
	'dojo/node!util',
	'./pretty/Results'
], function (intern, has, PTYView, util, Results) {
	var pretty;

	if(has('browser')) {
		throw new Error('reporter cannot be run in a browser');
	}

	function getNumTestsInSuite(tests) {
		if (!util.isArray(tests)) {
			return 1;
		}

		return tests.reduce(function(value, tests) {
			return value + getNumTestsInSuite(tests.tests);
		}, 0);
	}

	function isRootSuite(suite) {
		return suite.name && suite.name === 'main' && !suite.parent;
	}

	return (pretty = {
		start: function () {
			console.log('Running in ' + intern.mode + ' mode');
		},

		// after the runner has finished its configuration process and has started the Sauce Connect server
		'/runner/start': noop,

		// when a suite is about to start executing.
		'/suite/start': function (suite) {
			if (isRootSuite(suite)) {
				var total = getNumTestsInSuite(suite.tests);
				if(suite.sessionId) {
					// functional test
				}
				pretty.results = new Results(total, 10);
				pretty.view = new PTYView(total);
				console.log('main suite with ' + total + ' tests');
//				console.log(suite);
				pretty.view.start();
			}
		},

		// after a test environment has been successfully initialised but before it has been instructed to run any tests
		'/session/start': function (remote) {
			console.log('Initialised ' + remote.environmentType);
//			console.log(remote);
		},

		// when new suite is created
//		'/suite/new': report('/suite/new'),

		// when a suite has finished running
		'/suite/end': function (suite) {
			if (suite.name === 'main') {
				pretty.view.displayResults(pretty.results);
//				console.log('session: ' + suite.sessionId);
			}
		},

		// when an error occurs within a test suite
//		'/suite/error': report('/suite/error'),

		'/test/pass': function () {
			pretty.results.recordPassed();
		},
		'/test/skip': function () {
			pretty.results.recordSkipped();
		},
		'/test/fail': function () {
			pretty.results.recordFailed();
		},

		// when code coverage data has been retrieved from an environment under test
		'/coverage': noop,

		// published once for each deprecated method that is called on the WebDriver client
		'/deprecated': noop
	});

	// TODO remove me
	function noop() { }

	// TODO remove me
	function report(title) {
		return function () {
			console.log(title);
			console.log(util.inspect(arguments, { depth: 3 }));
		}
	}
})