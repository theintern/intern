define([
	'require',
	'intern!object',
	'intern/chai!assert',
	'intern-selftest/lib/reporters/pretty',
	'intern/lib/args',
	'./support/mocks',
	'dojo/node!istanbul/lib/collector',
	'dojo/has!host-node?dojo/node!istanbul/lib/report/text'
], function (require, registerSuite, assert, pretty, args, mock, Collector, Reporter) {
	/* globals process */

	registerSuite(function () {
		var mockCharm;

		function createReport(results, total, type) {
			var report = new pretty._Report(type);
			results && results.forEach(function (value) {
				report.record(value);
			});
			total && (report.total = total);
			return report;
		}

		function createStub(callback) {
			var func = function () {
				func.args.push(arguments);
				callback && callback.apply(this, arguments);
			};
			func.args = [];
			return func;
		}

		return {
			name: 'intern/lib/reporters/pretty',

			'beforeEach': function () {
				function fluentMockCharmFunc() {
					return mockCharm;
				}

				mockCharm = {
					write: function (str) {
						mockCharm.out += str;
					},
					erase: fluentMockCharmFunc,
					position: fluentMockCharmFunc,
					foreground: fluentMockCharmFunc,
					display: fluentMockCharmFunc,
					pipe: createStub()
				};
				mockCharm.out = '';
				pretty.header = '';
				pretty.tunnelStatus = '';
				pretty.charm = mockCharm;
				pretty.dimensions = {
					width: 80,
					height: 24
				};
				pretty.total = createReport();
				pretty.reporters = {};
				pretty.sessions = [];
				pretty.log = [];
			},

			'_Report': function () {
				var report = createReport([0, 1, 2]);
				assert.deepEqual(report.type, '');
				assert.deepEqual(report.passed, 1);
				assert.deepEqual(report.skipped, 1);
				assert.deepEqual(report.failed, 1);
				assert.lengthOf(report.results, 3);
				assert.deepEqual([0, 1, 2], report.results);
				assert.deepEqual(report.getCompressedResults(1), [2]);
				assert.deepEqual(report.getCompressedResults(2), [1, 2]);
				assert.deepEqual(report.getCompressedResults(3), [0, 1, 2]);
				assert.deepEqual(report.getCompressedResults(4), [0, 1, 2]);
			},

			'_render': {
				'empty': function () {
					pretty._render();
					assert.equal(mockCharm.out, 'Total: Pending\nPassed: 0  Failed: 0  Skipped: 0\n');
				},

				'without logs': function () {
					var expected = 'Total: [✓✓✓✓~×✓✓✓                     ]  9/30\n' +
						'Passed: 7   Failed: 1   Skipped: 1\n' +
						'\n' +
						'Chr :     [✓✓~       ]  3/10, 1 skip\n' +
						'Fx  24:   [✓✓✓       ]  3/10\n' +
						'IE  11:   [×✓✓       ]  3/10, 1 fail\n' +
						'Unkn:     [     ] 0/5\n';
					pretty.total = createReport([0, 0, 0, 0, 1, 2, 0, 0, 0], 30);
					pretty.reporters = {
						'1': createReport([0, 0, 1], 10, { browserName: 'chrome' }),
						'2': createReport([0, 0, 0], 10, { browserName: 'firefox', version: '24.0.1' }),
						'3': createReport([2, 0, 0], 10, { browserName: 'internet explorer', version: '11'}),
						'4': createReport([], 5, { browserName: 'Unknown' })
					};
					pretty.sessions = ['1', '2', '3', '4'];
					pretty._render();
					assert.equal(mockCharm.out, expected);
				},

				'with logs': function () {
					var expected = 'Total: [××××                          ]  4/30\n' +
						'Passed: 0   Failed: 4   Skipped: 0\n' +
						'\n' +
						'line 1\n' +
						'line 2\n' +
						'line 3\n' +
						'line 4';
					pretty.total = createReport([2, 2, 2, 2], 30);
					pretty.log = [
						'line 1',
						'line 2',
						'line 3',
						'line 4'
					];
					pretty._render();
					assert.equal(mockCharm.out, expected);
				},

				'with tunnel status and header': function () {
					var expected = 'header\n' +
						'Tunnel: tunnel\n' +
						'\n' +
						'Total: [✓✓✓✓✓                         ]  5/30\n' +
						'Passed: 5   Failed: 0   Skipped: 0\n';
					pretty.total = createReport([0, 0, 0, 0, 0], 30);
					pretty.tunnelStatus = 'tunnel';
					pretty.header = 'header';
					pretty._render();
					assert.equal(mockCharm.out, expected);
				},

				'large progress bar becomes compressed': function () {
					var expected = 'Total: [×  ]   5/100\n' +
						'Passed: 2    Failed: 1    Skipped: 2\n';
					pretty.total = createReport([0, 1, 2, 1, 0], 100);
					pretty.dimensions = {
						width: 20,
						height: 5
					};
					pretty._render();
					assert.equal(mockCharm.out, expected);
				}
			},

			'start': function () {
				var stdoutOn = process.stdout.on;

				try {
					process.stdout.on = createStub();
					pretty.dimensions = {};

					pretty.start();

					assert.lengthOf(process.stdout.on.args, 1);
					assert.lengthOf(mockCharm.pipe.args, 1);
					assert.isDefined(pretty.dimensions.width);
					assert.isDefined(pretty.dimensions.height);
					assert.isDefined(pretty._renderTimeout);
				}
				finally {
					process.stdout.on = stdoutOn;
					clearTimeout(pretty._renderTimeout);
				}
			},

			'stop': function () {
				var oldReporterWriteReport = Reporter.prototype.writeReport;
				Reporter.prototype.writeReport = createStub();

				try {
					pretty.log = ['1', '3', '2'];
					pretty.stop();
					assert.equal(mockCharm.out, 'Total: Pending\nPassed: 0  Failed: 0  Skipped: 0\n1\n2\n3\n');
					assert.lengthOf(Reporter.prototype.writeReport.args, 1);
				}
				finally {
					Reporter.prototype.writeReport = oldReporterWriteReport;
				}
			},

			'session based tests': (function () {
				var sessionId = 'sessionId';
				var remote = {
					sessionId: sessionId,
					environmentType: 'environment'
				};
				var oldCollectorAdd;

				function assertTestResult(handlerName, result) {
					var test = { error: new Error('hello') };

					return function () {
						// client unit tests
						pretty[handlerName](test);
						assert.lengthOf(pretty.total.results, 1);
						assert.lengthOf(pretty.log, 1);
						assert.equal(pretty.total.results[0], result);

						// runner tests
						var reporter = pretty.reporters[sessionId];
						test.sessionId = sessionId;
						pretty[handlerName](test);
						assert.lengthOf(pretty.total.results, 2);
						assert.lengthOf(pretty.log, 2);
						assert.equal(pretty.total.results[1], result);
						assert.lengthOf(reporter.results, 1);
						assert.equal(reporter.results[0], result);
					};
				}

				return {
					beforeEach: function () {
						pretty['/session/start'](remote);
						oldCollectorAdd = Collector.prototype.add;
					},

					afterEach: function () {
						Collector.prototype.add = oldCollectorAdd;
					},

					'/session/start': function () {
						assert.lengthOf(pretty.sessions, 1);
						assert.instanceOf(pretty.reporters[sessionId], pretty._Report);
					},

					'/coverage': function () {
						Collector.prototype.add = createStub(function (coverage) {
							assert.deepEqual(coverage, mock.coverage,
								'Collector#add should be called with the correct mockCoverage object');
						});
						pretty['/coverage'](sessionId, mock.coverage);
						assert.lengthOf(Collector.prototype.add.args, 2);
						pretty['/coverage']('', mock.coverage);
						assert.lengthOf(Collector.prototype.add.args, 3);
					},

					'/suite/start': function () {
						var suite = {
							name: 'main',
							numTests: 10
						};
						// client unit tests
						pretty['/suite/start'](suite);
						assert.equal(pretty.total.total, 10);

						// runner tests
						suite.sessionId = sessionId;
						pretty['/suite/start'](suite);
						assert.equal(pretty.reporters[sessionId].total, 10);
						assert.equal(pretty.total.total, 20);
					},

					'/test/skip': assertTestResult('/test/skip', 1),
					'/test/fail': assertTestResult('/test/fail', 2),
					'/test/pass': assertTestResult('/test/pass', 0),

					'/tunnel/start': function () {
						pretty['/tunnel/start']();
						assert.equal(pretty.tunnelStatus, 'Starting');
					},

					'/tunnel/download/progress': function () {
						pretty['/tunnel/download/progress'](undefined, {
							received: 99,
							total: 100
						});
						assert.equal(pretty.tunnelStatus, 'Downloading 99.00%');
					},

					'/tunnel/status': function () {
						var status = 'hello world!';
						pretty['/tunnel/status'](undefined, status);
						assert.equal(pretty.tunnelStatus, status);
					},

					'/error': function () {
						var error = new Error('error');
						pretty['/error'](error);
						assert.lengthOf(pretty.log, 1);
						assert.equal(pretty.log[0], '! error');
					},

					'/deprecated': function () {
						pretty['/deprecated']('java', 'javascript');
						assert.lengthOf(pretty.log, 1);
						assert.equal(pretty.log[0], '⚠ java is deprecated. Use javascript instead.');
					}
				};
			})()
		};
	});
});
