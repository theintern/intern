define([ 'dojo/has',
	'./pretty/PTYView',
	'dojo/node!util'
], function (has, PTYView, util) {
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

		},

		'/runner/start': noop,
		'/suite/start': function (suite) {
			if (isRootSuite(suite)) {
				var total = getNumTestsInSuite(suite.tests);
				pretty.view = new PTYView(total);
			}
		},
		'/suite/new': report('/suite/new'),
		'/suite/end': noop,
		'/suite/error': noop,
		'/test/pass': function () {
			pretty.view.testPassed();
		},
		'/test/skip': function () {
			pretty.view.testSkipped();
		},
		'/test/fail': function () {
			pretty.view.testFailed();
		},
		'/coverage': noop
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