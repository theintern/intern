define([
	'intern!object',
	'dojo/Deferred',
	'dojo/node!fs',
	'intern/chai!assert'
], function (registerSuite, Deferred, fs, assert) {
	var reporter;

	function deleteReport() {
		try {
			fs.unlinkSync(reporter.reportFileName);
		} catch (e) {
			// ignore
		}
	}

	function loadReport() {
		return fs.readFileSync(reporter.reportFileName, { encoding: 'utf-8' });
	}

	registerSuite({
		name: 'intern/lib/reporters/xml',

		setup: function () {
			require.config({
				packages: [ { name: 'intern-xmltest', location: '.' } ],
				map: { 'intern-xmltest': { dojo: 'intern-xmltest/node_modules/dojo' }}
			});
		},

		beforeEach: function () {
			var dfd = new Deferred();
			deleteReport();
			require.undef('intern-xmltest/lib/reporters/xml');
			require([ 'intern-xmltest/lib/reporters/xml' ], function (xml) {
				reporter = xml;
				dfd.resolve();
			});
			return dfd.promise;
		},

		afterEach: function () {
			deleteReport();
		},

		'/client/end': function () {
			// var suite = new Suite({ name: 'suite' });
			reporter.reportFileName = 'selftest-client-end.xml';
			reporter['/client/end']();
			assert.ok(fs.existsSync(reporter.reportFileName), 'report file should exist');
		},

		'/runner/end': function () {
			// var suite = new Suite({ name: 'suite' });
			reporter.reportFileName = 'selftest-runner-end.xml';
			reporter['/runner/end']();
			assert.ok(fs.existsSync(reporter.reportFileName), 'report file should exist');
		},

		'simple session': function () {
			var remote = {
				sessionId: 'foo',
				environmentType: {
					browserName: 'chrome',
					version: '32',
					platform: 'Mac'
				}
			};
			var suite = {
				sessionId: remote.sessionId,
				id: 'bar',
				name: 'bar',
				numTests: 0,
				numFailedTests: 0
			};

			reporter.reportFileName = 'selftest-simple-session.xml';
			reporter['/session/start'](remote);
			reporter['/suite/start'](suite);
			reporter['/suite/end'](suite);
			reporter['/runner/end']();
			assert.ok(fs.existsSync(reporter.reportFileName), 'report file should exist');

			var report = loadReport();
			assert.include(report, 'testsuite name="bar" tests="0"', 'report should contain bar test suite');
		},

		'/test/end': (function () {
			var suite = {
				id: 'bar',
				name: 'bar',
				numTests: 0,
				numFailedTests: 0
			};

			function doTest(test) {
				reporter.reportFileName = 'selftest-test-end.xml';
				reporter['/suite/start'](suite);
				reporter['/test/end'](test);
				reporter['/suite/end'](suite);
				reporter['/runner/end']();
				assert.ok(fs.existsSync(reporter.reportFileName), 'report file should exist');

				var report = loadReport();
				assert.include(report, 'testsuite name="bar" tests="0"', 'report should contain bar test suite');
			}

			return {
				'Error': function () {
					doTest({
						name: 'baz',
						timeElapsed: 0,
						error: new Error('fail')
					});
				},

				'object error': function () {
					doTest({
						name: 'baz',
						timeElapsed: 0,
						error: { constructor: {} }
					});
				},

				'no error': function () {
					doTest({
						name: 'baz',
						timeElapsed: 0
					});
				}
			};
		})(),

		'error session': (function () {
			var remote = {
				sessionId: 'foo',
				environmentType: {
					browserName: 'chrome',
					version: '32',
					platform: 'Mac'
				}
			};

			function doTest(suite, errorType, message) {
				reporter.reportFileName = 'selftest-error-session.xml';
				reporter['/session/start'](remote);
				reporter['/suite/start'](suite);
				reporter['/suite/error'](suite);
				reporter['/runner/end']();
				assert.ok(fs.existsSync(reporter.reportFileName), 'report file should exist');

				var report = loadReport();
				var text = 'failure type="' + errorType + '"';
				if (message) {
					text += ' message="' + message + '"';
				}
				assert.include(report, text, 'report should contain expected error');
			}

			return {
				'Error': function () {
					var suite = {
						sessionId: remote.sessionId,
						name: 'bar',
						numTests: 0,
						numFailedTests: 0,
						error: new Error('fail')
					};

					doTest(suite, 'Error', 'fail');
				},

				'number': function () {
					var suite = {
						sessionId: remote.sessionId,
						name: 'bar',
						numTests: 0,
						numFailedTests: 0,
						error: { constructor: {} } 
					};

					doTest(suite, 'Error');
				},

				'no sessionId': function () {
					var suite = {
						name: 'bar',
						numTests: 0,
						numFailedTests: 0,
						error: new Error('fail')
					};

					doTest(suite, 'Error');
				}
			};
		})()
	});
});

