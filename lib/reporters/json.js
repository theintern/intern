define([], function () {
	function logMessage(message) {
		console.log(JSON.stringify(message));
	}

	return {
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
			var error = suite.error;
			logMessage({
				topic: '/suite/error',
				message: 'ERROR: suite "' + suite.name + '"' + (error.stack ? '\n' + error.stack : ''),
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
			var error = test.error;
			logMessage({
				topic: '/test/fail',
				message: 'FAIL: ' + test.id + (error.stack ? '\n' + error.stack : ''),
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
				message: 'ERROR: ' + error.message + (error.stack ? '\n' + error.stack : ''),
				error: error
			});
		}
	};
});
