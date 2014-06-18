define([
	'intern!object',
	'intern/chai!assert',
	'../../../lib/util',
	'../../../lib/EnvironmentType',
	'dojo/has',
	'dojo/has!host-node?dojo/node!fs',
	'dojo/has!host-node?dojo/node!path'
], function (registerSuite, assert, util, EnvironmentType, has, fs, pathUtil) {
	/* jshint maxlen:140 */
	registerSuite({
		name: 'intern/lib/util',

		// TODO
		'.createQueue': function () {},

		'.flattenEnvironments': function () {
			var capabilities = { isCapabilities: true };
			var environments = [ {
				browserName: [ 'a', 'b' ],
				version: [ '1', '2' ],
				platform: [ 'c', 'd' ],
				platformVersion: [ '3', '4' ]
			} ];

			var expectedEnvironments = [
				new EnvironmentType({ browserName: 'a', version: '1', platform: 'c', platformVersion: '3', isCapabilities: true }),
				new EnvironmentType({ browserName: 'a', version: '1', platform: 'c', platformVersion: '4', isCapabilities: true }),
				new EnvironmentType({ browserName: 'a', version: '1', platform: 'd', platformVersion: '3', isCapabilities: true }),
				new EnvironmentType({ browserName: 'a', version: '1', platform: 'd', platformVersion: '4', isCapabilities: true }),
				new EnvironmentType({ browserName: 'a', version: '2', platform: 'c', platformVersion: '3', isCapabilities: true }),
				new EnvironmentType({ browserName: 'a', version: '2', platform: 'c', platformVersion: '4', isCapabilities: true }),
				new EnvironmentType({ browserName: 'a', version: '2', platform: 'd', platformVersion: '3', isCapabilities: true }),
				new EnvironmentType({ browserName: 'a', version: '2', platform: 'd', platformVersion: '4', isCapabilities: true }),
				new EnvironmentType({ browserName: 'b', version: '1', platform: 'c', platformVersion: '3', isCapabilities: true }),
				new EnvironmentType({ browserName: 'b', version: '1', platform: 'c', platformVersion: '4', isCapabilities: true }),
				new EnvironmentType({ browserName: 'b', version: '1', platform: 'd', platformVersion: '3', isCapabilities: true }),
				new EnvironmentType({ browserName: 'b', version: '1', platform: 'd', platformVersion: '4', isCapabilities: true }),
				new EnvironmentType({ browserName: 'b', version: '2', platform: 'c', platformVersion: '3', isCapabilities: true }),
				new EnvironmentType({ browserName: 'b', version: '2', platform: 'c', platformVersion: '4', isCapabilities: true }),
				new EnvironmentType({ browserName: 'b', version: '2', platform: 'd', platformVersion: '3', isCapabilities: true }),
				new EnvironmentType({ browserName: 'b', version: '2', platform: 'd', platformVersion: '4', isCapabilities: true })
			];

			assert.deepEqual(util.flattenEnvironments(capabilities, environments), expectedEnvironments,
				'Browser, version, platform, platform version environment properties should be permutated');
		},

		'.logError': function () {
			// Some environments do not have a console to log to
			if (typeof console === 'undefined') {
				return;
			}

			var oldConsoleError = console.error;
			var lastMessage;
			console.error = function (error) {
				lastMessage = error.toString();
			};

			try {
				util.logError('oops');
				assert.strictEqual(lastMessage, 'oops');

				util.logError({ name: 'OopsError', message: 'oops2' });
				assert.strictEqual(lastMessage, 'OopsError: oops2\nNo stack or location');

				util.logError({ name: 'OopsError', message: 'oops3', fileName: 'did-it-again.js' });
				assert.strictEqual(lastMessage, 'OopsError: oops3\n  at did-it-again.js\nNo stack');

				util.logError({ name: 'OopsError', message: 'oops4', fileName: 'did-it-again.js', lineNumber: '1' });
				assert.strictEqual(lastMessage, 'OopsError: oops4\n  at did-it-again.js:1\nNo stack');

				util.logError({ name: 'OopsError', message: 'oops5', fileName: 'did-it-again.js', lineNumber: '1', columnNumber: '0' });
				assert.strictEqual(lastMessage, 'OopsError: oops5\n  at did-it-again.js:1:0\nNo stack');

				util.logError({ name: 'OopsError', message: 'oops6', stack: 'OopsError: oops6\nat did-it-again.js:1:0' });
				assert.strictEqual(lastMessage, 'OopsError: oops6\n  at <did-it-again.js:1:0>');

				util.logError({ name: 'OopsError', message: 'oops7', stack: 'oops7\nat did-it-again.js:1:0' });
				assert.strictEqual(lastMessage, 'OopsError: oops7\n  at <did-it-again.js:1:0>');

				util.logError({ name: 'OopsError', message: 'oops8', stack: 'at did-it-again.js:1:0' });
				assert.strictEqual(lastMessage, 'OopsError: oops8\n  at <did-it-again.js:1:0>');

				util.logError({ name: 'OopsError', message: 'oops9', stack: '\nat did-it-again.js:1:0' });
				assert.strictEqual(lastMessage, 'OopsError: oops9\n  at <did-it-again.js:1:0>');

				util.logError({ name: 'OopsError', stack: 'OopsError: oops10\nat did-it-again.js:1:0' });
				assert.strictEqual(lastMessage, 'OopsError: Unknown error\nOopsError: oops10\n  at <did-it-again.js:1:0>');

				// Chrome/IE stack
				util.logError({
					name: 'OopsError',
					stack: '    at Foo (http://localhost:8080/test.js:2:8)\n    at http://localhost:8080/test.html:7:5'
				});
				assert.strictEqual(lastMessage, 'OopsError: Unknown error\n  at Foo  <test.js:2:8>\n  at <test.html:7:5>');

				// Safari/Firefox stack
				util.logError({
					name: 'OopsError',
					stack: 'Foo@http://localhost:8080/test.js:2:8\nhttp://localhost:8080/test.html:7:5\nfail'
				});
				assert.strictEqual(lastMessage, 'OopsError: Unknown error\n  at Foo  <test.js:2:8>\n  at <test.html:7:5>\nfail');

				// check that sourcemap resolution is working
				if (has('host-node')) {
					var testfile = pathUtil.resolve('lib/util.js');
					var testdata = fs.readFileSync(testfile).toString('utf-8');
					util.instrument(testdata, testfile);
					try {
						// should throw an error at the first line of logError
						util.logError();
					} catch (e) {
						util.logError(e);
						assert.include(lastMessage, '/lib/util.js:379');
					}
				}
			}
			finally {
				console.error = oldConsoleError;
			}
		}
	});
});
