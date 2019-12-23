import { readFileSync, writeFileSync } from 'fs';
import * as Benchmark from 'benchmark';
import { Executor } from '../executors/Executor';
import Reporter, { eventHandler, ReporterProperties } from './Reporter';
import BenchmarkTest from '../BenchmarkTest';
import Test from '../Test';
import Suite from '../Suite';

/**
 * Benchmark is a reporter that can generate a baseline report and do runtime
 * comparisons against an existing baseline.
 *
 * **Configuration**
 *
 * Along with the default reporter options, Benchmark also supports a `mode`
 * option. This can have two values:
 *
 * * `'baseline'`: Benchmark data will be written to a baseline file when
 *   testing is finished
 * * `'test'`: Benchmark is compared to a baseline read from a file when testing
 *   starts
 *
 * Baseline data is stored hierarchically by environment and then by test.
 *
 * **Notation**
 *
 * * **rme:** relative margin of error -- margin of error as a percentage of the
 *   mean margin of error
 * * **mean:** mean execution time per function run
 * * **hz:** Hertz (number of executions of a function per second). 1/Hz is the
 *   mean execution time of function.
 */
export default class BenchmarkReporter extends Reporter
  implements BenchmarkReporterProperties {
  baseline!: BenchmarkBaseline;

  filename: string;

  mode: BenchmarkMode;

  sessions: { [sessionId: string]: SessionInfo };

  thresholds: BenchmarkThresholds;

  constructor(executor: Executor, options: BenchmarkReporterOptions = {}) {
    super(executor, options);

    this.mode = options.mode || 'test';
    this.filename = options.filename || '';
    this.thresholds = options.thresholds || {};

    // In test mode, try to load benchmark data for comparison
    if (this.mode === 'test') {
      try {
        this.baseline = JSON.parse(
          readFileSync(this.filename, { encoding: 'utf8' })
        );
      } catch (error) {
        this.console.warn(
          'Unable to load benchmark baseline data from ' + this.filename
        );
        this.console.warn('Switching to "baseline" mode');
        this.mode = 'baseline';
      }
    }

    if (!this.baseline) {
      this.baseline = {};
    }

    // Cache environments by session ID so we can look them up again when
    // serialized tests come back from remote browsers
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
        client = environmentType.browserName!;
        version = environmentType.version!;
        platform = environmentType.platform!;
      } else {
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
        existingBaseline = JSON.parse(
          readFileSync(this.filename, { encoding: 'utf8' })
        );
      } catch (error) {
        existingBaseline = {};
      }

      // Merge the newly recorded baseline data into the existing baseline
      // data and write it back out to output file.
      const baseline = this.baseline;
      Object.keys(baseline).forEach(function(environmentId) {
        existingBaseline[environmentId] = baseline[environmentId];
      });
      writeFileSync(
        this.filename,
        JSON.stringify(existingBaseline, null, '    ')
      );
    }
  }

  @eventHandler()
  suiteEnd(suite: Suite) {
    const session = this._getSession(suite);

    if (!suite.hasParent) {
      const environment = session.environment;
      this.console.log(
        'Finished benchmarking ' +
          environment.client +
          ' ' +
          environment.version +
          ' on ' +
          environment.platform
      );
    } else if (this.mode === 'test') {
      const suiteInfo = session.suites[suite.id];
      const numTests = suiteInfo.numBenchmarks;
      if (numTests > 0) {
        const numFailedTests = suiteInfo.numFailedBenchmarks;
        const message =
          numFailedTests + '/' + numTests + ' benchmarks failed in ' + suite.id;
        if (numFailedTests > 0) {
          this.console.warn(message);
        } else {
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
      const environmentName =
        environment.client +
        ' ' +
        environment.version +
        ' on ' +
        environment.platform;
      const baselineEnvironments = this.baseline;

      this.console.log(
        (this.mode === 'baseline' ? 'Baselining' : 'Benchmarking') +
          ' ' +
          environmentName
      );

      if (this.mode === 'baseline') {
        baselineEnvironments[environment.id] = {
          client: environment.client,
          version: environment.version,
          platform: environment.platform,
          tests: {}
        };
      } else if (!baselineEnvironments[environment.id]) {
        this.console.warn('No baseline data for ' + environmentName + '!');
      }
    } else {
      session.suites[suite.id] = {
        numBenchmarks: 0,
        numFailedBenchmarks: 0
      };
    }
  }

  @eventHandler()
  testEnd(test: Test) {
    const benchmarkTest = <BenchmarkTest>test;

    // Just check for the benchmark property because the test may be a
    // deserialized object rather than an actual BenchmarkTest instance.
    if (benchmarkTest.benchmark == null) {
      return;
    }

    if (benchmarkTest.error) {
      const session = this._getSession(benchmarkTest);
      const suiteInfo = session.suites[benchmarkTest.parentId];
      suiteInfo.numBenchmarks++;
      suiteInfo.numFailedBenchmarks++;

      this.console.error('FAIL: ' + benchmarkTest.id);
      this.console.error(
        this.executor.formatError(benchmarkTest.error, { space: '  ' })
      );
    } else {
      const checkTest = (baseline: BenchmarkData, benchmark: BenchmarkData) => {
        let warn: string[] = [];
        let fail: string[] = [];
        let list: string[];

        const baselineMean = baseline.stats.mean;
        const thresholds = this.thresholds || {};
        let percentDifference =
          (100 * (benchmark.stats.mean - baselineMean)) / baselineMean;

        if (
          thresholds.warn &&
          thresholds.warn.mean &&
          Math.abs(percentDifference) > thresholds.warn.mean
        ) {
          list = warn;
          if (
            thresholds.fail &&
            thresholds.fail.mean &&
            Math.abs(percentDifference) > thresholds.fail.mean
          ) {
            list = fail;
          }
          list.push(
            'Execution time is ' + percentDifference.toFixed(1) + '% off'
          );
        }

        const baselineRme = baseline.stats.rme;
        // RME is already a percent
        percentDifference = benchmark.stats.rme - baselineRme;
        if (
          thresholds.warn &&
          thresholds.warn.rme &&
          Math.abs(percentDifference) > thresholds.warn.rme
        ) {
          list = warn;
          if (
            thresholds.fail &&
            thresholds.fail.rme &&
            Math.abs(percentDifference) > thresholds.fail.rme
          ) {
            list = fail;
          }
          list.push('RME is ' + percentDifference.toFixed(1) + '% off');
        }

        if (fail.length) {
          this.console.error(
            'FAIL ' + benchmarkTest.id + ' (' + fail.join(', ') + ')'
          );
          return false;
        } else if (warn.length) {
          this.console.warn(
            'WARN ' + benchmarkTest.id + ' (' + warn.join(', ') + ')'
          );
        } else {
          this.console.log('PASS ' + benchmarkTest.id);
        }

        return true;
      };

      const benchmark = benchmarkTest.benchmark;
      const session = this._getSession(benchmarkTest);
      const environment = session.environment;

      const suiteInfo = session.suites[benchmarkTest.parentId];
      suiteInfo.numBenchmarks++;

      const baseline = this.baseline[environment.id]!;

      if (this.mode === 'baseline') {
        baseline.tests[benchmarkTest.id] = {
          hz: benchmark.hz,
          times: benchmark.times,
          stats: {
            rme: benchmark.stats.rme,
            moe: benchmark.stats.moe,
            mean: benchmark.stats.mean
          }
        };
        this.console.log('Baselined ' + benchmarkTest.name);
        this.executor.log(
          'Time per run:',
          formatSeconds(benchmark.stats.mean),
          '\xb1',
          benchmark.stats.rme.toFixed(2),
          '%'
        );
      } else {
        if (baseline) {
          const testData = baseline.tests[benchmarkTest.id];
          const result = checkTest(testData, benchmark);
          const baselineStats = testData.stats;
          const benchmarkStats = benchmark.stats;
          this.executor.log(
            'Expected time per run:',
            formatSeconds(baselineStats.mean),
            '\xb1',
            baselineStats.rme.toFixed(2),
            '%'
          );
          this.executor.log(
            'Actual time per run:',
            formatSeconds(benchmarkStats.mean),
            '\xb1',
            benchmarkStats.rme.toFixed(2),
            '%'
          );

          if (!result) {
            suiteInfo.numFailedBenchmarks++;
          }
        }
      }
    }
  }
}

export interface BenchmarkData {
  times: Benchmark.Times;
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
}

export interface BenchmarkBaseline {
  [key: string]: BaselineEnvironment;
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
    };
  };
  environment: SesssionEnvironment;
}

export type BenchmarkMode = 'baseline' | 'test';

export interface BenchmarkReporterProperties extends ReporterProperties {
  filename: string;
  mode: BenchmarkMode;
  thresholds: BenchmarkThresholds;
}

export type BenchmarkReporterOptions = Partial<BenchmarkReporterProperties>;

function formatSeconds(value: number) {
  if (value == null) {
    return null;
  }

  let units = 's';
  if (value < 1) {
    const places = Math.ceil(Math.log(value) / Math.log(10)) - 1;
    if (places < -9) {
      value *= Math.pow(10, 12);
      units = 'ps';
    } else if (places < -6) {
      value *= Math.pow(10, 9);
      units = 'ns';
    } else if (places < -3) {
      value *= Math.pow(10, 6);
      units = 'µs';
    } else if (places < 0) {
      value *= Math.pow(10, 3);
      units = 'ms';
    }
  }

  return value.toFixed(3) + units;
}
