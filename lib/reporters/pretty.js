define([
	'intern',
	'dojo/has',
	'./pretty/PTYView',
	'dojo/node!util',
	'./pretty/Results',
	'../ClientSuite',
], function (intern, has, PTYView, util, Results, ClientSuite) {
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

	function getSessionId(test) {
		var sessionId;
		for(var parent = test; parent; parent = parent.parent) {
			sessionId = parent.sessionId || parent._sessionId || (parent.remote && parent.remote.sessionId);
			if (sessionId) {
				return sessionId;
			}
		}
	}

	function isRootSuite(suite) {
		return suite.name && suite.name === 'main' && !suite.parent;
	}

	function isFunctionalSuite(suite) {
		return !!suite._remote;
	}

	return (pretty = {
		start: function () {
			console.log('Running in ' + intern.mode + ' mode');
			pretty.sessions = {};
			pretty.view = new PTYView();
			pretty.view.start();
		},

		// after the runner has finished its configuration process and has started the Sauce Connect server
		'/runner/start': noop,

		// when a suite is about to start executing.
		'/suite/start': function (suite) {
			if (isRootSuite(suite)) {
				var total = getNumTestsInSuite(suite.tests);
				var results = new Results(total, 10);
				var sessionId = getSessionId(suite);
				var info = {
					suite: suite,
					results: results,
					isFunctional: isFunctionalSuite(suite)
				};

				if (pretty.sessions.hasOwnProperty(sessionId)) {
					pretty.sessions[sessionId].push(info);
				} else {
					pretty.sessions[sessionId] = [info];
				}
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
//				pretty.view.displayClientResults(pretty.results);
//				console.log('session: ' + suite.sessionId);
			}
		},

		// when an error occurs within a test suite
//		'/suite/error': report('/suite/error'),

		'/test/pass': function (test) {
//			console.log(test);
//			console.log('success for session: ' + getSessionId(test));
//			pretty.results.recordPassed();
		},
		'/test/skip': function (test) {
//			pretty.results.recordSkipped();
		},
		'/test/fail': function (test) {
//			pretty.results.recordFailed();
		},

		// when code coverage data has been retrieved from an environment under test
		'/runner/end': function () {
			var sessions = pretty.sessions;
			console.log('end');
		},

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