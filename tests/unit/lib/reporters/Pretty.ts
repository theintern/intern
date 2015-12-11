import registerSuite = require('intern!object');
import { assert } from 'intern/chai!';
import { default as Pretty, Result, Report } from '../../../../lib/reporters/Pretty';
import EnvironmentType from '../../../../lib/EnvironmentType';
import Suite from './support/MockableSuite';
import Test from './support/MockableTest';
import { coverage as mockCoverage } from './support/mocks';
import { CoverageMap } from 'istanbul/lib/instrumenter';
import Collector = require('istanbul/lib/collector');
import MockStream from './support/MockStream';
import charm = require('charm');
import { Command } from '../../../../lib/ProxiedSession';

function fillArray(length: number, fill: number) {
	return Array.apply(null, { length: length }).map(function () {
		return fill;
	});
}

function createReport(results: Result[], total?: number, type?: EnvironmentType) {
	const report = new Report(type);
	results.forEach(function (value) {
		report.record(value);
	});
	if (typeof total !== 'undefined') {
		report.numTotal = total;
	}
	return report;
}

function createStub(object: {}, method: string) {
	const oldFunction: Function = (<any> object)[method];
	const handle = {
		remove() {
			this.remove = function () {};
			(<any> object)[method] = oldFunction;
		},
		args: <IArguments[]> []
	};

	(<any> object)[method] = function () {
		handle.args.push(arguments);
	};

	return handle;
}

registerSuite(function () {
	function bar(results: Result[]) {
		return results.map(function (result) {
			return pretty.colorReplacement[result] || result;
		}).join('');
	}

	let pretty: Pretty;
	let mockStream: MockStream;

	return {
		name: 'intern/lib/reporters/Pretty',

		beforeEach() {
			mockStream = new MockStream();
			pretty = new Pretty();
			pretty.charm = charm(<NodeJS.WritableStream> mockStream);
		},

		Report() {
			const report = createReport([ 0, 1, 2 ]);
			assert.isUndefined(report.environment);
			assert.deepEqual(report.numPassed, 1);
			assert.deepEqual(report.numSkipped, 1);
			assert.deepEqual(report.numFailed, 1);
			assert.lengthOf(report.results, 3);
			assert.deepEqual(report.results, [ 0, 1, 2 ]);
			assert.deepEqual(report.getCompressedResults(1), [ 2 ]);
			assert.deepEqual(report.getCompressedResults(2), [ 1, 2 ]);
			assert.deepEqual(report.getCompressedResults(3), [ 0, 1, 2 ]);
			assert.deepEqual(report.getCompressedResults(4), [ 0, 1, 2 ]);
		},

		_render: {
			empty() {
				pretty._render();
				assert.equal(mockStream.data, 'Total: Pending\nPassed: 0  Failed: 0  Skipped: 0\n');
			},

			simple() {
				pretty.total = createReport([ 0, 0, 0, 0, 1, 2, 0, 0, 0 ], 30);
				pretty._render();
				const expected = 'Total: [' + bar(pretty.total.results) + '-                    ]  9/30\n' +
					'Passed: 7   Failed: 1   Skipped: 1\n';
				assert.equal(mockStream.data, expected);
			},

			'without logs'() {
				pretty.total = createReport([ 0, 0, 0, 0, 1, 2, 0, 0, 0 ], 30);
				pretty.reporters = {
					1: createReport(
						[ 0, 0, 1 ], 10,
						new EnvironmentType({ browserName: 'chrome' })
					),
					2: createReport(
						[ 0, 0, 0 ], 10,
						new EnvironmentType({ browserName: 'firefox', version: '24.0.1' })
					),
					3: createReport(
						[ 2, 0, 0 ], 10,
						new EnvironmentType({ browserName: 'internet explorer', version: '11' })
					),
					4: createReport(
						[], 5,
						new EnvironmentType({ browserName: 'Unknown', platform: 'Windows' })
					)
				};
				pretty._render();

				const expected = 'Total: [' + bar(pretty.total.results) + '-                    ]  9/30\n' +
					'Passed: 7   Failed: 1   Skipped: 1\n' +
					'\n' +
					'Chr:        [' + bar(pretty.reporters[1].results) + '-      ]  3/10, 1 skip\n' +
					'Fx 24:      [' + bar(pretty.reporters[2].results) + '-      ]  3/10\n' +
					'IE 11:      [' + bar(pretty.reporters[3].results) + '-      ]  3/10, 1 fail\n' +
					'Unkn Win:   [-    ] 0/5\n';
				assert.equal(mockStream.data, expected);
			},

			'with logs'() {
				/* jshint maxlen: 160 */
				pretty.total = createReport([ 2, 2, 2, 2 ], 30);
				pretty.log = [
					'⚠ expected line',
					'× expected line',
					'× expected line\nsecond line',
					'! expected really long line with some really important stuff to say but we will never know ' +
						'because it is going to be truncated',
					'✓ line',
					'! expected line',
					'~ line'
				];
				pretty._render();

				const expected = 'Total: [' + bar(pretty.total.results) + '-                         ]  4/30\n' +
					'Passed: 0   Failed: 4   Skipped: 0\n' +
					'\n' +
					pretty.colorReplacement['⚠'] + '⚠ expected line\x1b[0m\n' +
					pretty.colorReplacement['×'] + '× expected line\x1b[0m\n' +
					pretty.colorReplacement['×'] + '× expected line\x1b[0m\n' +
					pretty.colorReplacement['!'] + '! expected really long line with some really important ' +
					'stuff to say but we will \x1b[0m\n' +
					pretty.colorReplacement['!'] + '! expected line\x1b[0m';
				assert.equal(mockStream.data, expected);
			},

			'with tunnel status and header'() {
				pretty.total = createReport([0, 0, 0, 0, 0], 30);
				pretty.tunnelState = 'tunnel';
				pretty.header = 'header';
				pretty._render();

				const expected = 'header\n' +
					'Tunnel: tunnel\n' +
					'\n' +
					'Total: [' + bar(pretty.total.results) + '-                        ]  5/30\n' +
					'Passed: 5   Failed: 0   Skipped: 0\n';
				assert.equal(mockStream.data, expected);
			},

			'large progress bar becomes compressed'() {
				const expected = 'Total: [' + pretty.colorReplacement[2] + '- ]   5/100\n' +
					'Passed: 2    Failed: 1    Skipped: 2\n';
				pretty.total = createReport([ 0, 1, 2, 1, 0 ], 100);
				pretty.dimensions = {
					width: 20,
					height: 5
				};
				pretty._render();
				assert.equal(mockStream.data, expected);
			},

			'large progress bar exceeding maxAllowed is compressed'() {
				const expected = 'Total: [' + bar(fillArray(40, 0)) + ']  99/100\n' +
					'Passed: 99   Failed: 0    Skipped: 0\n';
				pretty.total = createReport(fillArray(99, 0), 100);
				pretty.dimensions = {
					width: 100,
					height: 5
				};
				pretty._render();
				assert.equal(mockStream.data, expected);
			},

			'spinner advances on each render'() {
				function assertSpinner(spinner: string) {
					pretty._render();

					const expected = 'Total: [' + bar(pretty.total.results) + spinner + '    ]  5/10\n' +
						'Passed: 5   Failed: 0   Skipped: 0\n';
					assert.equal(mockStream.data, expected);
					mockStream.data = '';
				}

				pretty.total = createReport(fillArray(5, 0), 10);
				assertSpinner('-');
				assertSpinner('\\');
				assertSpinner('|');
				assertSpinner('/');
				assertSpinner('-');
			}
		},

		runEnd() {
			const expected = pretty.colorReplacement['✓'] + '✓ 0\n' +
				pretty.colorReplacement['⚠'] + '⚠ 1\n' +
				pretty.colorReplacement['~'] + '~ 2\n' +
				pretty.colorReplacement['×'] + '× 3\n' +
				pretty.colorReplacement['!'] + '! 4\n\n' +
				'Total: Pending\n' +
				'Passed: 0  Failed: 0  Skipped: 0\n\n';
			const stub = createStub((<any> pretty)._reporter, 'writeReport');

			pretty.log = ['! 4', '~ 2', '× 3', '⚠ 1', '✓ 0'];
			pretty.runEnd();
			assert.equal(mockStream.data, expected);
			assert.lengthOf(stub.args, 1);
		},

		'session based tests': (function () {
			const sessionId = 'sessionId';
			const sessionSuite = new Suite({
				remote: <Command<void>> {
					environmentType: new EnvironmentType({ browserName: 'internet explorer', platform: 'WINDOWS' })
				},
				sessionId: sessionId
			});

			const expectedLog = <{ [result: number]: string; }> {
				0: '✓ test',
				1: '~ test: Skipped',
				2: '× test\nError: Oops'
			};

			function assertTestResult(handlerName: string, result: Result) {
				const suite = new Suite();
				const test = new Test({
					name: 'test',
					parent: suite,
					hasPassed: false,
					error: new Error('Oops'),
					skipped: 'Skipped'
				});
				suite.tests.push(test);

				return function () {
					// client unit tests
					(<any> pretty)[handlerName](test);
					assert.lengthOf(pretty.total.results, 1);
					assert.lengthOf(pretty.log, 1);
					assert.strictEqual(pretty.log[0].split('\n', 2).join('\n'), expectedLog[result]);
					assert.strictEqual(pretty.total.results[0], result);

					// runner tests
					const reporter = pretty.reporters[sessionId];

					// set the suite's remote & sessionId so the reporter will treat it as a session suite
					suite.remote = <Command<void>> {
						environmentType: new EnvironmentType({
							browserName: 'internet explorer',
							platform: 'WINDOWS'
						})
					};
					suite.sessionId = sessionId;

					(<any> pretty)[handlerName](test);
					assert.lengthOf(pretty.total.results, 2);
					assert.lengthOf(pretty.log, 2);
					assert.strictEqual(pretty.log[1].split('\n', 2).join('\n'), expectedLog[result]);
					assert.strictEqual(pretty.total.results[1], result);
					assert.lengthOf(reporter.results, 1);
					assert.strictEqual(reporter.results[0], result);
				};
			}

			return {
				beforeEach() {
					pretty.suiteStart(sessionSuite);
				},

				coverage() {
					const sessionCoverageArgs: CoverageMap[] = [];
					const totalCoverageArgs: CoverageMap[] = [];
					pretty.reporters[sessionSuite.sessionId].coverage = <Collector> {
						add(coverage) {
							sessionCoverageArgs.push(coverage);
						}
					};
					pretty.total.coverage = <Collector> {
						add(coverage) {
							totalCoverageArgs.push(coverage);
						}
					};

					pretty.coverage(sessionId, mockCoverage);
					assert.lengthOf(sessionCoverageArgs, 1, 'Collector#add should have been called once');
					assert.strictEqual(sessionCoverageArgs[0], mockCoverage,
						'Collector#add should be called with the correct mockCoverage object');
					pretty.coverage('', mockCoverage);
					assert.lengthOf(sessionCoverageArgs, 1);
					assert.lengthOf(totalCoverageArgs, 2);
				},

				'new session'() {
					const suite = <Suite> {
						numTests: 10
					};
					// client unit tests
					pretty.suiteStart(suite);
					assert.strictEqual(pretty.total.numTotal, 10);

					// runner tests
					suite.remote = <Command<void>> {
						environmentType: new EnvironmentType({
							browserName: 'internet explorer',
							platform: 'WINDOWS'
						})
					};
					suite.sessionId = sessionId;
					pretty.suiteStart(suite);
					assert.strictEqual(pretty.reporters[sessionId].numTotal, 10);
					assert.strictEqual(pretty.total.numTotal, 20);
				},

				testSkip: assertTestResult('testSkip', 1),
				testFail: assertTestResult('testFail', 2),
				testPass: assertTestResult('testPass', 0),

				tunnelStart() {
					pretty.tunnelStart();
					assert.strictEqual(pretty.tunnelState, 'Starting');
				},

				tunnelDownloadProgress() {
					pretty.tunnelDownloadProgress(null, {
						loaded: 99,
						total: 100
					});
					assert.strictEqual(pretty.tunnelState, 'Downloading 99.00%');
				},

				tunnelStatus() {
					const status = 'hello world!';
					pretty.tunnelStatus(null, status);
					assert.strictEqual(pretty.tunnelState, status);
				},

				fatalError() {
					const error = new Error('error');
					pretty.fatalError(error);
					assert.lengthOf(pretty.log, 1);
					assert.match(pretty.log[0], /^! error\nError: error/);
				},

				deprecated() {
					pretty.deprecated('java', 'javascript');
					assert.lengthOf(pretty.log, 1);
					assert.strictEqual(pretty.log[0], '⚠ java is deprecated. Use javascript instead.');
				}
			};
		})()
	};
});
