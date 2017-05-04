/**
 * Benchmark is a reporter that can generate a baseline report and do runtime comparisons against an existing baseline.
 *
 * Configuration
 * -------------
 * Along with the default reporter options, Benchmark also supports a `mode` option. This can have two
 * values:
 *
 *     'baseline': Benchmark data will be written to a baseline file when testing is finished
 *     'test': Benchmark is compared to a baseline read from a file when testing starts
 *
 * Baseline data is stored hierarchically by environment and then by test.
 *
 * Notation
 * --------
 * rme: relative margin of error -- margin of error as a percentage of the mean margin of error
 * mean: mean execution time per function run
 * hz: Hertz (number of executions of a function per second). 1/Hz is the mean execution time of function.
 */
import { readFileSync, writeFileSync } from 'fs';
import Executor from '../executors/Executor';
import Reporter, { eventHandler, ReporterProperties } from './Reporter';
import BenchmarkTest from '../BenchmarkTest';
import Test from '../Test';
import Suite from '../Suite';
import _Benchmark = require('benchmark');

export default class Benchmark extends Reporter implements BenchmarkReporterProperties {
	baseline: BenchmarkBaseline;

	filename: string;

	mode: string;

	sessions: { [sessionId: string]: SessionInfo };

	verbosity: number;

	thresholds: BenchmarkThresholds;

	constructor(executor: Executor, config: BenchmarkReporterOptions) {
		super(executor, config);

		// In test mode, try to load benchmark data for comparison
		if (this.mode === 'test') {
			try {
				this.baseline = JSON.parse(readFileSync(this.filename, { encoding: 'utf8' }));
			}
			catch (error) {
				this.console.warn('Unable to load benchmark baseline data from ' + this.filename);
				this.console.warn('Switching to "baseline" mode');
				this.mode = 'baseline';
			}
		}

		if (!this.baseline) {
			this.baseline = { environments: {}, tests: {} };
		}
		else if (!this.baseline.tests) {
			this.baseline.tests = {};
		}

		// Cache environments by session ID so we can look them up again when serialized tests come back from remote
		// browsers
		this.sessions = {};
	}

	_getSession(testOrSuite: Test | Suite) {
		const sessionId = testOrSuite.sessionId || 'local';
		let session = this.sessions[sessionId];

		if (!session) {
			let client: string;
			let version: string;
			let platform: string;

			if (testOrSuite.sessionId) {
				const environmentType = testOrSuite.remote.environmentType!;
				client = environmentType.browserName;
				version = environmentType.version;
				platform = environmentType.platform;
			}
			else {
				client = process.title;
				version = process.version;
				platform = process.platform;
			}

			session = this.sessions[sessionId] = {
				suites: {},
				environment: {
					client,
					version,
					platform,
					id: client + ':' + version + ':' + platform
				}
			};
		}

		return session;
	}

	@eventHandler()
	runEnd() {
		if (this.mode === 'baseline') {
			let existingBaseline: BenchmarkBaseline;
			try {
				existingBaseline = JSON.parse(readFileSync(this.filename, { encoding: 'utf8' }));
			}
			catch (error) {
				existingBaseline = {
					environments: {},
					tests: {}
				};
			}

			// Merge the newly recorded baseline data into the existing baseline data and write it back out to
			// output file.
			const baseline = this.baseline;
			Object.keys(baseline.environments).forEach(function (environmentId) {
				existingBaseline.environments[environmentId] = baseline.environments[environmentId];
			});
			writeFileSync(this.filename, JSON.stringify(existingBaseline, null, '    '));
		}
	}

	@eventHandler()
	suiteEnd(suite: Suite) {
		const session = this._getSession(suite);

		if (!suite.hasParent) {
			const environment = session.environment;
			this.console.log('Finished ' + environment.client + ' ' + environment.version + ' on ' + environment.platform);
		}
		else if (this.mode === 'test') {
			const suiteInfo = session.suites[suite.id];
			const numTests = suiteInfo.numBenchmarks;
			if (numTests > 0) {
				const numFailedTests = suiteInfo.numFailedBenchmarks;
				const message = numFailedTests + '/' + numTests + ' benchmarks failed in ' + suite.id;
				if (numFailedTests > 0) {
					this.console.warn(message);
				}
				else {
					this.console.log(message);
				}
			}
		}
	}

	@eventHandler()
	suiteStart(suite: Suite) {
		const session = this._getSession(suite);

		// This is a session root suite
		if (!suite.hasParent) {
			const environment = session.environment;
			const environmentName = environment.client + ' ' + environment.version + ' on ' + environment.platform;
			const baselineEnvironments = this.baseline.environments;

			this.console.log((this.mode === 'baseline' ? 'Baselining' : 'Benchmark testing') + ' ' + environmentName);

			if (this.mode === 'baseline') {
				baselineEnvironments[environment.id] = <BaselineEnvironment>{
					client: environment.client,
					version: environment.version,
					platform: environment.platform,
					tests: {},
					stats: {}
				};
			}
			else if (!baselineEnvironments[environment.id]) {
				this.console.warn('No baseline data for ' + environmentName + '!');
			}
		}
		else {
			session.suites[suite.id] = {
				numBenchmarks: 0,
				numFailedBenchmarks: 0
			};
		}
	}

	@eventHandler()
	testEnd(test: BenchmarkTest) {
		if (test.error) {
			const session = this._getSession(test);
			const suiteInfo = session.suites[test.parentId];
			suiteInfo.numBenchmarks++;
			suiteInfo.numFailedBenchmarks++;

			this.console.error('ERROR: ' + test.id);
			if (test.error) {
				this.console.error(this.executor.formatter.format(test.error));
			}
		}
		else {
			const checkTest = (baseline: BenchmarkData, benchmark: BenchmarkData) => {
				let warn: string[] = [];
				let fail: string[] = [];
				let list: string[];

				const baselineMean = baseline.stats.mean;
				const thresholds = this.thresholds || {};
				let percentDifference = 100 * (benchmark.stats.mean - baselineMean) / baselineMean;

				if (thresholds.warn && thresholds.warn.mean && Math.abs(percentDifference) > thresholds.warn.mean) {
					list = warn;
					if (thresholds.fail && thresholds.fail.mean && Math.abs(percentDifference) > thresholds.fail.mean) {
						list = fail;
					}
					list.push('Execution time is ' + percentDifference.toFixed(1) + '% off');
				}

				const baselineRme = baseline.stats.rme;
				// RME is already a percent
				percentDifference = benchmark.stats.rme - baselineRme;
				if (thresholds.warn && thresholds.warn.rme && Math.abs(percentDifference) > thresholds.warn.rme) {
					list = warn;
					if (thresholds.fail && thresholds.fail.rme && Math.abs(percentDifference) > thresholds.fail.rme) {
						list = fail;
					}
					list.push('RME is ' + percentDifference.toFixed(1) + '% off');
				}

				if (fail.length) {
					this.console.error('FAIL ' + test.id + ' (' + fail.join(', ') + ')');
					return false;
				}
				else if (warn.length) {
					this.console.warn('WARN ' + test.id + ' (' + warn.join(', ') + ')');
				}
				else {
					this.console.log('PASS ' + test.id);
				}

				return true;
			};

			// Ignore non-benchmark tests
			if (!test.benchmark) {
				this.executor.log('Ignoring non-benchmark test', test.id);
				return;
			}

			const benchmark = test.benchmark;
			const session = this._getSession(test);
			const environment = session.environment;

			const suiteInfo = session.suites[test.parentId];
			suiteInfo.numBenchmarks++;

			const baselineEnvironments = this.baseline.environments;
			const baseline = baselineEnvironments[environment.id]!;

			if (this.mode === 'baseline') {
				baseline.tests[test.id] = {
					hz: benchmark.hz,
					times: benchmark.times,
					stats: {
						rme: benchmark.stats.rme,
						moe: benchmark.stats.moe,
						mean: benchmark.stats.mean
					}
				};
				this.console.log('Baselined ' + test.name);
				this.executor.log('Time per run:', formatSeconds(benchmark.stats.mean), '\xb1',
					benchmark.stats.rme.toFixed(2), '%');
			}
			else {
				if (baseline) {
					const testData = baseline.tests[test.id];
					const result = checkTest(testData, benchmark);
					const baselineStats = baseline.stats;
					const benchmarkStats = baseline.stats;
					this.executor.log('Expected time per run:', formatSeconds(baselineStats.mean), '\xb1',
						baselineStats.rme.toFixed(2), '%');
					this.executor.log('Actual time per run:', formatSeconds(benchmarkStats.mean), '\xb1',
						benchmarkStats.rme.toFixed(2), '%');

					if (!result) {
						suiteInfo.numFailedBenchmarks++;
					}
				}
			}
		}
	}
}

export interface BenchmarkData {
	times: _Benchmark.Times;
	hz: number;
	stats: {
		rme: number;
		moe: number;
		mean: number;
	};
}

export interface BenchmarkThresholds {
	warn?: {
		rme?: number;
		hz?: number;
		mean?: number;
	};
	fail?: {
		rme?: number;
		hz?: number;
		mean?: number;
	};
}

export interface BaselineEnvironment {
	client: string;
	version: string;
	platform: string;
	tests: { [testId: string]: BenchmarkData };
	stats: _Benchmark.Stats;
}

export interface BenchmarkBaseline {
	environments: { [key: string]: BaselineEnvironment };
	tests: { [key: string]: BenchmarkData };
	[key: string]: any;
}

export interface SesssionEnvironment {
	client: string;
	version: string;
	platform: string;
	id: string;
}

export interface SessionInfo {
	suites: {
		[suiteId: string]: {
			numBenchmarks: number;
			numFailedBenchmarks: number;
		}
	};
	environment: SesssionEnvironment;
	[key: string]: any;
}

export interface BenchmarkReporterProperties extends ReporterProperties {
	filename: string;
	mode: string;
	thresholds: BenchmarkThresholds;
	verbosity: number;
}

export type BenchmarkReporterOptions = Partial<BenchmarkReporterProperties>;

// jshint node:true
function formatSeconds(value: number) {
	let units = 's';
	if (value < 1) {
		const places = Math.ceil(Math.log(value) / Math.log(10)) - 1;
		if (places < -9) {
			value *= Math.pow(10, 12);
			units = 'ps';
		}
		else if (places < -6) {
			value *= Math.pow(10, 9);
			units = 'ns';
		}
		else if (places < -3) {
			value *= Math.pow(10, 6);
			units = 'µs';
		}
		else if (places < 0) {
			value *= Math.pow(10, 3);
			units = 'ms';
		}
	}

	return value.toFixed(3) + units;
}
