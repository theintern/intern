define([
	'intern!object',
	'intern/chai!assert',
	'../../lib/util',
	'dojo/has',
	'dojo/has!host-node?dojo/node!fs'
], function (registerSuite, assert, util, has, fs) {
	function runWithMockConsole(func) {
		var consoleError = console.error;
		var messages = [];

		console.error = function () {
			if (arguments.length === 1) {
				messages.push(arguments[0]);
			}
			else {
				messages.push(arguments);
			}
		};

		try {
			func();
		}
		finally {
			console.error = consoleError;
		}

		return messages;
	}

	var suite = {
		name: 'args',

		'logError': (function () {
			return {
				'Error': function () {
					var messages = runWithMockConsole(function () {
						util.logError(new Error('foo'));
					});
					assert.notEqual(messages.length, 0, 'Should have posted error messages');
					assert.include(messages[0], 'Error: ');
				},

				'Chrome/IE stack': function () {
					var messages = runWithMockConsole(function () {
						util.logError({
							name: 'Error',
							stack: '    at Foo (http://localhost:8080/test.js:2:8)\n    at http://localhost:8080/test.html:7:5' 
						});
					});
					assert.lengthOf(messages, 1, 'Should have posted error messages');
					assert.equal(messages[0], 'Error: Unknown error\n  at Foo  <test.js:2:8>\n  at <test.html:7:5>');
				},

				'Safari/FireFox stack': function () {
					var messages = runWithMockConsole(function () {
						util.logError({
							name: 'Error',
							message: 'Fail',
							stack: 'Foo@http://localhost:8080/test.js:2:8\nhttp://localhost:8080/test.html:7:5\nfail' 
						});
					});
					assert.lengthOf(messages, 1, 'Should have posted error messages');
					assert.equal(messages[0], 'Error: Fail\n  at Foo  <test.js:2:8>\n  at <test.html:7:5>\nfail');
				},

				'object': function () {
					var messages = runWithMockConsole(function () {
						util.logError('foo');
					});
					assert.lengthOf(messages, 1, 'Should have posted error messages');
					assert.equal(messages[0], 'foo');
				},

				'filename': function () {
					var messages = runWithMockConsole(function () {
						util.logError({
							name: 'Error',
							message: 'fail',
							fileName: 'foo.js',
							lineNumber: 2,
							columnNumber: 10
						});
					});
					assert.lengthOf(messages, 1, 'Should have posted error messages');
					assert.equal(messages[0], 'Error: fail\n  at foo.js:2:10\nNo stack');
				},

				'no location': function () {
					var messages = runWithMockConsole(function () {
						util.logError({ name: 'Error', message: 'fail' });
					});
					assert.lengthOf(messages, 1, 'Should have posted error messages');
					assert.equal(messages[0], 'Error: fail\nNo stack or location');
				}
			};
		})()
	};

	if (has('host-node')) {
		suite.instrument = (function () {
			var data = fs.readFileSync('./main.js', { encoding: 'utf-8' });

			return {
				'with filename': function () {
					var code = util.instrument(data, './main.js');
					assert.ok(typeof code === 'string', 'Instrumenter should have returned a string');
				},

				'without filename': function () {
					var code = util.instrument(data);
					assert.ok(typeof code === 'string', 'Instrumenter should have returned a string');
				}
			};
		})();
	}

	registerSuite(suite);
});
