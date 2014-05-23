define([], function () {
	var consoleLog;
	var consoleInfo;

	function logMessage(message) {
		consoleLog(JSON.stringify(message));
	}

	return {
		start: function () {
			// redirect stdout streams to stderr; json messages are the only thing that should be emitted on stdout
			consoleLog = console.log;
			consoleInfo = console.info;
			console.log = console.error;
			console.info = console.error;
		},

		remove: function () {
			console.log = consoleLog;
			console.info = consoleInfo;
		},

		'/suite/start': function (suite) {
			logMessage({
				topic: '/suite/start',
				message: 'Suite ' + suite.name + ' started',
				suite: suite
			});
		},

		'/suite/end': function (suite) {
			var numTests = suite.numTests,
				numFailedTests = suite.numFailedTests;
			logMessage({
				topic: '/suite/end',
				message: suite.name + ': ' + (numTests - numFailedTests) + '/' + numTests + ' tests passed',
				suite: suite
			});
		},

		'/suite/error': function (suite) {
			var stack = suite.error && suite.error.stack;
			logMessage({
				topic: '/suite/error',
				message: 'ERROR: suite "' + suite.name + '"' + (stack ? '\n' + stack : ''),
				suite: suite
			});
		},

		'/test/pass': function (test) {
			logMessage({
				topic: '/test/pass',
				message: 'PASS: ' + test.id,
				test: test
			});
		},

		'/test/fail': function (test) {
			var stack = test.error && test.error.stack;
			logMessage({
				topic: '/test/fail',
				message: 'FAIL: ' + test.id + (stack ? '\n' + stack : ''),
				test: test
			});
		},

		'/test/end': function (test) {
			var stack = test.error && test.error.stack;
			logMessage({
				topic: '/test/end',
				message: 'FAIL: ' + test.id + (stack ? '\n' + stack : ''),
				test: test
			});
		},

		'/session/start': function (remote) {
			logMessage({
				topic: '/session/start',
				message: 'Running on ' + remote.environmentType
			});
		},

		'/session/end': function (remote) {
			logMessage({
				topic: '/session/end',
				message: 'Finished on ' + remote.environmentType
			});
		},

		'/error': function (error) {
			logMessage({
				topic: '/error',
				message: 'ERROR: ' + error.message + (error.stack ? '\n' + error.stack : '')
			});
		}
	};
});
