/* jshint unused:strict */
define([
	'intern!object',
	'intern/chai!assert',
	'../../../../lib/reporters/pretty',
	'../../../../lib/EnvironmentType',
	'../../../../lib/Suite',
	'../../../../lib/Test',
	'./support/mocks',
	'dojo/node!istanbul/lib/collector',
	'dojo/has!host-node?dojo/node!istanbul/lib/report/text'
], function (registerSuite, assert, pretty, EnvironmentType, Suite, Test, mock, Collector, Reporter) {
	/* globals process */

	function bar(results) {
		return results.map(function (result) {
			return pretty.options.colorReplacement[result] || result;
		}).join('');
	}

	function fillArray(length, fill) {
		return Array.apply(null, { length: length }).map(function () {
			return fill;
		});
	}

	registerSuite(function () {
		var mockCharm;

		function createReport(results, total, type) {
			var report = new pretty._Report(type);
			results && results.forEach(function (value) {
				report.record(value);
			});
			total && (report.numTotal = total);
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
				pretty.spinnerOffset = 0;
			},

			'_Report': function () {
				var report = createReport([0, 1, 2]);
				assert.deepEqual(report.type, '');
				assert.deepEqual(report.numPassed, 1);
				assert.deepEqual(report.numSkipped, 1);
				assert.deepEqual(report.numFailed, 1);
				assert.lengthOf(report.results, 3);
				assert.deepEqual(report.results, [0, 1, 2]);
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

				'simple': function () {
					pretty.total = createReport([0, 0, 0, 0, 1, 2, 0, 0, 0], 30);
					pretty._render();

					var expected = 'Total: [' + bar(pretty.total.results) + '-                    ]  9/30\n' +
						'Passed: 7   Failed: 1   Skipped: 1\n';
					assert.equal(mockCharm.out, expected);
				},

				'without logs': function () {
					pretty.total = createReport([0, 0, 0, 0, 1, 2, 0, 0, 0], 30);
					pretty.reporters = {
						'1': createReport(
							[ 0, 0, 1 ], 10,
							new EnvironmentType({ browserName: 'chrome' })
						),
						'2': createReport(
							[ 0, 0, 0 ], 10,
							new EnvironmentType({ browserName: 'firefox', version: '24.0.1' })
						),
						'3': createReport(
							[ 2, 0, 0 ], 10,
							new EnvironmentType({ browserName: 'internet explorer', version: '11'})
						),
						'4': createReport(
							[], 5,
							new EnvironmentType({ browserName: 'Unknown', platform: 'Windows' })
						)
					};
					pretty.sessions = ['1', '2', '3', '4'];
					pretty._render();

					var expected = 'Total: [' + bar(pretty.total.results) + '-                    ]  9/30\n' +
						'Passed: 7   Failed: 1   Skipped: 1\n' +
						'\n' +
						'Chr:        [' + bar(pretty.reporters[1].results) + '-      ]  3/10, 1 skip\n' +
						'Fx 24:      [' + bar(pretty.reporters[2].results) + '-      ]  3/10\n' +
						'IE 11:      [' + bar(pretty.reporters[3].results) + '-      ]  3/10, 1 fail\n' +
						'Unkn Win:   [-    ] 0/5\n';
					assert.equal(mockCharm.out, expected);
				},

				'with logs': function () {
					/* jshint maxlen: 160 */
					pretty.total = createReport([2, 2, 2, 2], 30);
					pretty.log = [
						'⚠ expected line',
						'× expected line',
						'× expected line\nsecond line',
						'! expected really long line with some really important stuff to say but we will never know because it is going to be truncated',
						'✓ line',
						'! expected line',
						'~ line'
					];
					pretty._render();

					var expected = 'Total: [' + bar(pretty.total.results) + '-                         ]  4/30\n' +
						'Passed: 0   Failed: 4   Skipped: 0\n' +
						'\n' +
						pretty.options.colorReplacement['⚠'] + '⚠ expected line\x1b[0m\n' +
						pretty.options.colorReplacement['×'] + '× expected line\x1b[0m\n' +
						pretty.options.colorReplacement['×'] + '× expected line\x1b[0m\n' +
						pretty.options.colorReplacement['!'] + '! expected really long line with some really important stuff to say but we will \x1b[0m\n' +
						pretty.options.colorReplacement['!'] + '! expected line\x1b[0m';
					assert.equal(mockCharm.out, expected);
				},

				'with tunnel status and header': function () {
					pretty.total = createReport([0, 0, 0, 0, 0], 30);
					pretty.tunnelStatus = 'tunnel';
					pretty.header = 'header';
					pretty._render();

					var expected = 'header\n' +
						'Tunnel: tunnel\n' +
						'\n' +
						'Total: [' + bar(pretty.total.results) + '-                        ]  5/30\n' +
						'Passed: 5   Failed: 0   Skipped: 0\n';
					assert.equal(mockCharm.out, expected);
				},

				'large progress bar becomes compressed': function () {
					var expected = 'Total: [' + pretty.options.colorReplacement[2] + '- ]   5/100\n' +
						'Passed: 2    Failed: 1    Skipped: 2\n';
					pretty.total = createReport([0, 1, 2, 1, 0], 100);
					pretty.dimensions = {
						width: 20,
						height: 5
					};
					pretty._render();
					assert.equal(mockCharm.out, expected);
				},

				'large progress bar exceeding maxAllowed is compressed': function () {
					var expected = 'Total: [' + bar(fillArray(40, 0)) + ']  99/100\n' +
						'Passed: 99   Failed: 0    Skipped: 0\n';
					pretty.total = createReport(fillArray(99, 0), 100);
					pretty.dimensions = {
						width: 100,
						height: 5
					};
					pretty._render();
					assert.equal(mockCharm.out, expected);
				},

				'spinner advances on each render': function () {
					function assertSpinner(spinner) {
						pretty._render();

						var expected = 'Total: [' + bar(pretty.total.results) + spinner + '    ]  5/10\n' +
							'Passed: 5   Failed: 0   Skipped: 0\n';
						assert.equal(mockCharm.out, expected);
						mockCharm.out = '';
					}

					pretty.total = createReport(fillArray(5, 0), 10);
					assertSpinner('-');
					assertSpinner('\\');
					assertSpinner('|');
					assertSpinner('/');
					assertSpinner('-');
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
				var expected = pretty.options.colorReplacement['✓'] + '✓ 0\n' +
					pretty.options.colorReplacement['⚠'] + '⚠ 1\n' +
					pretty.options.colorReplacement['~'] + '~ 2\n' +
					pretty.options.colorReplacement['×'] + '× 3\n' +
					pretty.options.colorReplacement['!'] + '! 4\n\n' +
					'Total: Pending\n' +
					'Passed: 0  Failed: 0  Skipped: 0\n\n';
				var oldReporterWriteReport = Reporter.prototype.writeReport;
				Reporter.prototype.writeReport = createStub();

				try {
					pretty.log = ['! 4', '~ 2', '× 3', '⚠ 1', '✓ 0'];
					pretty.stop();
					assert.equal(mockCharm.out, expected);
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
					environmentType: new EnvironmentType({ browserName: 'internet explorer', platform: 'WINDOWS' })
				};
				var oldCollectorAdd;

				var expectedLog = {
					0: '✓ main - test',
					1: '~ main - test: Skipped',
					2: '× main - test\nError: Oops'
				};

				var expectedRunnerLog = {
					0: '✓ internet explorer on WINDOWS - test',
					1: '~ internet explorer on WINDOWS - test: Skipped',
					2: '× internet explorer on WINDOWS - test\nError: Oops'
				};

				function assertTestResult(handlerName, result) {
					var suite = new Suite({ name: 'main' });
					var test = new Test({
						name: 'test',
						parent: suite,
						hasPassed: false,
						error: new Error('Oops'),
						skipped: 'Skipped'
					});
					suite.tests.push(test);

					return function () {
						// client unit tests
						pretty[handlerName](test);
						assert.lengthOf(pretty.total.results, 1);
						assert.lengthOf(pretty.log, 1);
						assert.strictEqual(pretty.log[0].split('\n', 2).join('\n'), expectedLog[result]);
						assert.strictEqual(pretty.total.results[0], result);

						// runner tests
						var reporter = pretty.reporters[sessionId];
						suite.remote = remote;
						pretty[handlerName](test);
						assert.lengthOf(pretty.total.results, 2);
						assert.lengthOf(pretty.log, 2);
						assert.strictEqual(pretty.log[1].split('\n', 2).join('\n'), expectedRunnerLog[result]);
						assert.strictEqual(pretty.total.results[1], result);
						assert.lengthOf(reporter.results, 1);
						assert.strictEqual(reporter.results[0], result);
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
						assert.strictEqual(pretty.total.numTotal, 10);

						// runner tests
						suite.sessionId = sessionId;
						pretty['/suite/start'](suite);
						assert.strictEqual(pretty.reporters[sessionId].numTotal, 10);
						assert.strictEqual(pretty.total.numTotal, 20);
					},

					'/test/skip': assertTestResult('/test/skip', 1),
					'/test/fail': assertTestResult('/test/fail', 2),
					'/test/pass': assertTestResult('/test/pass', 0),

					'/tunnel/start': function () {
						pretty['/tunnel/start']();
						assert.strictEqual(pretty.tunnelStatus, 'Starting');
					},

					'/tunnel/download/progress': function () {
						pretty['/tunnel/download/progress'](undefined, {
							received: 99,
							numTotal: 100
						});
						assert.strictEqual(pretty.tunnelStatus, 'Downloading 99.00%');
					},

					'/tunnel/status': function () {
						var status = 'hello world!';
						pretty['/tunnel/status'](undefined, status);
						assert.strictEqual(pretty.tunnelStatus, status);
					},

					'/error': function () {
						var error = new Error('error');
						pretty['/error'](error);
						assert.lengthOf(pretty.log, 1);
						assert.strictEqual(pretty.log[0], '! error');
					},

					'/deprecated': function () {
						pretty['/deprecated']('java', 'javascript');
						assert.lengthOf(pretty.log, 1);
						assert.strictEqual(pretty.log[0], '⚠ java is deprecated. Use javascript instead.');
					}
				};
			})()
		};
	});
});
