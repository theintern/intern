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
import Reporter, { ReporterProperties } from './Reporter';
import Test from '../Test';
import Suite from '../Suite';
import _Benchmark = require('benchmark');

export default class Benchmark extends Reporter implements BenchmarkReporterProperties {
	baseline: BenchmarkBaseline;

	filename: string;

	mode: string;

	sessions: {
		[sessionId: string]: {
			suites: {
				[suiteId: string]: {
					numBenchmarks: number;
					numFailedBenchmarks: number;
				}
			};
			environment?: BenchmarkEnvironment;
			[key: string]: any;
		}
	};

	verbosity: number;

	thresholds: BenchmarkThresholds;

	constructor(executor: Executor, config: BenchmarkReporterOptions = {}) {
		super(executor, config);

		this.mode = config.mode;
		this.thresholds = config.thresholds;
		this.verbosity = config.verbosity;

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
			this.baseline = { environments: {} };
		}

		// Cache environments by session ID so we can look them up again when serialized tests come back from remote
		// browsers
		this.sessions = {};
	}

	_getSession(testOrSuite: Test | Suite) {
		const sessionId = testOrSuite.sessionId || 'local';
		let session = this.sessions[sessionId];

		if (!session) {
			let environment: BenchmarkEnvironment;
			session = this.sessions[sessionId] = {
				suites: {}
			};

			if (testOrSuite.sessionId) {
				environment = session.environment = {
					client: testOrSuite.remote.environmentType.browserName,
					version: testOrSuite.remote.environmentType.version,
					platform: testOrSuite.remote.environmentType.platform
				};
			}
			else {
				environment = session.environment = {
					client: process.title,
					version: process.version,
					platform: process.platform
				};
			}

			session.environment.id = environment.client + ':' + environment.version + ':' + environment.platform;
		}

		return session;
	}

	runEnd() {
		if (this.mode === 'baseline') {
			let existingBaseline: BenchmarkBaseline;
			try {
				existingBaseline = JSON.parse(readFileSync(this.filename, { encoding: 'utf8' }));
			}
			catch (error) {
				existingBaseline = { environments: {} };
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

	suiteStart(suite: Suite) {
		const session = this._getSession(suite);

		// This is a session root suite
		if (!suite.hasParent) {
			const environment = session.environment;
			const environmentName = environment.client + ' ' + environment.version + ' on ' + environment.platform;
			this.console.log((this.mode === 'baseline' ? 'Baselining' : 'Benchmark testing') + ' ' + environmentName);

			if (this.mode === 'baseline') {
				this.baseline.environments[environment.id] = {
					client: environment.client,
					version: environment.version,
					platform: environment.platform,
					tests: {}
				};
			}
			else if (!this.baseline.environments[environment.id]) {
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

	testPass(test: Test, benchmark?: BenchmarkData) {
		const checkTest = (baseline: BenchmarkData) => {
			let warn: string[] = [];
			let fail: string[] = [];
			let list: string[];

			const baselineMean = baseline.stats.mean;
			let percentDifference = 100 * (benchmark.stats.mean - baselineMean) / baselineMean;
			if (Math.abs(percentDifference) > this.thresholds.warn.mean) {
				list = warn;
				if (Math.abs(percentDifference) > this.thresholds.fail.mean) {
					list = fail;
				}
				list.push('Execution time is ' + percentDifference.toFixed(1) + '% off');
			}

			const baselineRme = baseline.stats.rme;
			// RME is already a percent
			percentDifference = benchmark.stats.rme - baselineRme;
			if (Math.abs(percentDifference) > this.thresholds.warn.rme) {
				list = warn;
				if (Math.abs(percentDifference) > this.thresholds.fail.rme) {
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
		if (!benchmark) {
			this.executor.log('Ignoring non-benchmark test', test.id);
			return;
		}

		const session = this._getSession(test);
		const environment = session.environment;

		const suiteInfo = session.suites[test.parentId];
		suiteInfo.numBenchmarks++;

		if (this.mode === 'baseline') {
			this.baseline.environments[environment.id].tests[test.id] = {
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
			let baseline = this.baseline.environments[environment.id];
			if (baseline) {
				const testData = baseline.tests[test.id];
				const result = checkTest(testData);
				this.executor.log('Expected time per run:', formatSeconds(baseline.stats.mean), '\xb1',
					baseline.stats.rme.toFixed(2), '%');
				this.executor.log('Actual time per run:', formatSeconds(benchmark.stats.mean), '\xb1',
					benchmark.stats.rme.toFixed(2), '%');

				if (!result) {
					suiteInfo.numFailedBenchmarks++;
				}
			}
		}
	}

	testFail(test: Test) {
		const session = this._getSession(test);
		const suiteInfo = session.suites[test.parentId];
		suiteInfo.numBenchmarks++;
		suiteInfo.numFailedBenchmarks++;

		this.console.error('ERROR: ' + test.id);
		this.console.error(this.executor.formatter.format(test.error));
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

export interface BenchmarkEnvironment {
	client: string;
	version: string;
	platform: string;
	id?: string;
	tests?: { [testId: string]: BenchmarkData };
	stats?: _Benchmark.Stats;
}

export interface BenchmarkBaseline {
	environments?: { [key: string]: BenchmarkEnvironment };
	[key: string]: any;
}

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

export interface BenchmarkReporterProperties extends ReporterProperties {
	filename: string;
	mode: string;
	thresholds: BenchmarkThresholds;
	verbosity: number;
}

export type BenchmarkReporterOptions = Partial<BenchmarkReporterProperties>;
