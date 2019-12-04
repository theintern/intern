import { createSandbox, SinonSandbox, SinonSpy } from 'sinon';
import _Benchmark from 'src/core/lib/reporters/Benchmark';
import {
  createMockConsole,
  createMockExecutor
} from 'tests/support/unit/mocks';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

let removeMocks: () => void;
let Benchmark: typeof _Benchmark;
let sandbox: SinonSandbox;
let fs: {
  readFileSync: SinonSpy<[string]>;
  writeFileSync: SinonSpy<[string, string]>;
};
let fileData: { [filename: string]: string };

registerSuite('src/core/lib/reporters/Benchmark', {
  before() {
    sandbox = createSandbox();
    fs = {
      readFileSync: sandbox.spy((name: string) => {
        return fileData[name];
      }),
      writeFileSync: sandbox.spy((name: string, data: string) => {
        fileData[name] = data;
      })
    };

    return mockRequire(require, 'src/core/lib/reporters/Benchmark', {
      fs
    }).then(resource => {
      removeMocks = resource.remove;
      Benchmark = resource.module.default;
    });
  },

  after() {
    removeMocks();
  },

  beforeEach() {
    sandbox.resetHistory();
    fileData = Object.create(null);
  },

  tests: {
    'construct a reporter': {
      'baseline mode'() {
        new Benchmark(createMockExecutor(), {
          console: <any>createMockConsole(),
          mode: 'baseline'
        });
        assert.equal(
          fs.readFileSync.callCount,
          0,
          'did not expect baseline file to be read'
        );
      },

      'test mode'() {
        fileData['benchmark.json'] = '{}';
        new Benchmark(createMockExecutor(), {
          console: <any>createMockConsole(),
          mode: 'test',
          filename: 'benchmark.json'
        });
        assert.equal(
          fs.readFileSync.callCount,
          1,
          'expected baseline file to be read'
        );
        assert.equal(fs.readFileSync.args[0][0], 'benchmark.json');
      },

      'missing baseline file'() {
        const reporter = new Benchmark(createMockExecutor(), {
          console: <any>createMockConsole(),
          mode: 'test',
          filename: 'foo.json'
        });
        assert.equal(
          fs.readFileSync.callCount,
          1,
          'expected baseline file to be read'
        );
        assert.equal(
          reporter.mode,
          'baseline',
          'expected mode to switch to "baseline"'
        );
      }
    },

    runEnd: {
      baseline() {
        fileData['benchmark.json'] = '{"stats":{}}';
        const reporter = new Benchmark(createMockExecutor(), {
          console: <any>createMockConsole(),
          mode: 'baseline',
          filename: 'benchmark.json'
        });

        fs.readFileSync.resetHistory();
        fs.writeFileSync.resetHistory();

        // Set some baseline data so runEnd will have some data to copy
        reporter.baseline = <any>{ node: { stats: {} } };

        reporter.runEnd();

        assert.equal(
          fs.readFileSync.callCount,
          1,
          'expected baseline file to be read'
        );
        assert.equal(fs.readFileSync.args[0][0], 'benchmark.json');
        assert.equal(
          fs.writeFileSync.callCount,
          1,
          'expected baseline file to be written'
        );
        assert.equal(fs.writeFileSync.args[0][0], 'benchmark.json');

        // Verify that the written data is the combination of the
        // original baseline (from benchmark.json) and the baseline data
        // explicitly set above
        assert.equal(
          fs.writeFileSync.args[0][1],
          JSON.stringify({ stats: {}, node: { stats: {} } }, null, '    ')
        );
      },

      'missing baseline'() {
        const reporter = new Benchmark(createMockExecutor(), {
          console: <any>createMockConsole(),
          mode: 'baseline',
          filename: 'benchmark.json'
        });

        fs.readFileSync.resetHistory();
        fs.writeFileSync.resetHistory();

        reporter.runEnd();

        assert.equal(
          fs.readFileSync.callCount,
          1,
          'expected baseline file to be read'
        );
        assert.equal(fs.readFileSync.args[0][0], 'benchmark.json');
        assert.equal(
          fs.writeFileSync.callCount,
          1,
          'expected baseline file to be written'
        );
        assert.equal(fs.writeFileSync.args[0][0], 'benchmark.json');
        assert.equal(fs.writeFileSync.args[0][1], '{}');
      },

      normal() {
        fileData['benchmark.json'] = '{}';
        const reporter = new Benchmark(createMockExecutor(), {
          console: <any>createMockConsole(),
          mode: 'test',
          filename: 'benchmark.json'
        });

        fs.readFileSync.resetHistory();
        fs.writeFileSync.resetHistory();

        // Ensure we're in test mode
        reporter.mode = 'test';

        reporter.runEnd();

        assert.equal(
          fs.readFileSync.callCount,
          0,
          'baseline file should not have been read'
        );
        assert.equal(
          fs.writeFileSync.callCount,
          0,
          'baseline file should not have been written'
        );
      }
    },

    suiteEnd: {
      'normal suite': {
        'passing test'() {
          const mockConsole = createMockConsole();
          fileData['benchmark.json'] = '{}';
          const reporter = new Benchmark(createMockExecutor(), {
            console: <any>mockConsole,
            mode: 'test',
            filename: 'benchmark.json'
          });

          const suite = <any>{
            hasParent: true,
            id: 'foo',
            // Use a custom sessionId; otherwise benchmark defaults
            // to 'local'
            sessionId: 'bar',
            // When a suite has a sessionId, it is assumed to also
            // have a remote
            remote: {
              environmentType: {
                browserName: 'chrome',
                version: '61',
                platform: 'MAC'
              }
            }
          };

          // Start the suite so it's registered in the session list
          reporter.suiteStart(suite);

          // Mark the suite as having benchmarks
          reporter.sessions[suite.sessionId].suites[suite.id].numBenchmarks = 1;

          reporter.suiteEnd(suite);

          assert.equal(mockConsole.log.callCount, 1);
          assert.equal(
            mockConsole.log.args[0][0],
            `0/1 benchmarks failed in ${suite.id}`
          );
        },

        'failing test'() {
          const mockConsole = createMockConsole();
          fileData['benchmark.json'] = '{}';
          const reporter = new Benchmark(createMockExecutor(), {
            console: <any>mockConsole,
            mode: 'test',
            filename: 'benchmark.json'
          });

          const suite = <any>{
            hasParent: true,
            id: 'foo'
          };

          // Start the suite so it's registered in the session list
          reporter.suiteStart(suite);

          // Mark the suite as having benchmarks
          const suiteInfo = reporter.sessions['local'].suites[suite.id];
          suiteInfo.numBenchmarks = 1;
          suiteInfo.numFailedBenchmarks = 1;

          reporter.suiteEnd(suite);

          assert.equal(mockConsole.warn.callCount, 1);
          assert.equal(
            mockConsole.warn.args[0][0],
            `1/1 benchmarks failed in ${suite.id}`
          );
        }
      },

      'root suite'() {
        const mockConsole = createMockConsole();
        fileData['benchmark.json'] = '{}';
        const reporter = new Benchmark(createMockExecutor(), {
          console: <any>mockConsole,
          mode: 'test',
          filename: 'benchmark.json'
        });

        const suite = <any>{
          hasParent: false,
          id: 'foo'
        };

        reporter.suiteEnd(suite);

        assert.equal(mockConsole.log.callCount, 1);
        assert.match(mockConsole.log.args[0][0], /^Finished benchmarking/);
      }
    },

    testEnd: {
      failed() {
        const mockConsole = createMockConsole();
        fileData['benchmark.json'] = '{}';
        const reporter = new Benchmark(createMockExecutor(), {
          console: <any>mockConsole,
          mode: 'test',
          filename: 'benchmark.json'
        });

        const test = <any>{
          benchmark: true,
          error: new Error('failed'),
          parentId: 'foo',
          id: 'foo - test'
        };

        const suite = <any>{
          id: 'foo'
        };

        reporter.suiteStart(suite);

        const suiteInfo = (reporter.sessions['local'].suites[test.parentId] = {
          numBenchmarks: 0,
          numFailedBenchmarks: 0
        });

        reporter.testEnd(test);

        assert.equal(mockConsole.error.callCount, 2);
        assert.match(mockConsole.error.args[0][0], /^FAIL:/);
        assert.equal(suiteInfo.numBenchmarks, 1);
      },

      'baseline mode'() {
        const mockConsole = createMockConsole();
        fileData['benchmark.json'] = '{}';
        const reporter = new Benchmark(createMockExecutor(), {
          console: <any>mockConsole,
          mode: 'baseline',
          filename: 'benchmark.json'
        });

        const test = <any>{
          benchmark: {
            stats: {
              rme: 1,
              moe: 2,
              mean: 3
            }
          },
          parentId: 'foo',
          id: 'foo - test'
        };

        const suite = <any>{
          id: 'foo'
        };

        reporter.suiteStart(suite);

        reporter.sessions['local'].suites[test.parentId] = {
          numBenchmarks: 0,
          numFailedBenchmarks: 0
        };

        mockConsole.log.resetHistory();
        reporter.testEnd(test);

        assert.equal(mockConsole.log.callCount, 1);
        assert.match(mockConsole.log.args[0][0], /^Baselined /);
      },

      'test mode': (() => {
        function runTest(thresholds: any, failureType?: string) {
          const mockConsole = createMockConsole();
          fileData['benchmark.json'] = '{}';
          const reporter = new Benchmark(createMockExecutor(), {
            console: <any>mockConsole,
            mode: 'test',
            filename: 'benchmark.json',
            thresholds
          });

          const test = <any>{
            benchmark: {
              stats: {
                rme: 1,
                moe: 2,
                mean: 3
              }
            },
            parentId: 'foo',
            id: 'foo - test'
          };

          const suite = <any>{
            id: 'foo'
          };

          reporter.suiteStart(suite);

          reporter.sessions['local'].suites[test.parentId] = {
            numBenchmarks: 0,
            numFailedBenchmarks: 0
          };
          const env = reporter.sessions['local'].environment.id;
          const baseline = {
            times: <any>{},
            hz: 10,
            stats: {
              rme: 1,
              moe: 2,
              mean: 0.3
            }
          };
          reporter.baseline[env] = {
            client: '',
            version: '',
            platform: '',
            tests: {
              [test.id]: baseline
            }
          };

          mockConsole.warn.resetHistory();
          mockConsole.error.resetHistory();

          mockConsole.log.resetHistory();
          reporter.testEnd(test);

          if (failureType) {
            let cons: typeof mockConsole.warn;

            if (failureType === 'warn') {
              cons = mockConsole.warn;
            }
            if (failureType === 'fail') {
              cons = mockConsole.error;
            }

            assert.equal(cons!.callCount, 1);

            const pctDiff =
              (100 * (test.benchmark.stats.mean - baseline.stats.mean)) /
              baseline.stats.mean;
            assert.match(
              cons!.args[0][0],
              new RegExp(
                `${failureType.toUpperCase()} ${
                  test.id
                } \\(Execution time is ${pctDiff.toFixed(1)}% off\\)`
              )
            );
          } else {
            assert.equal(mockConsole.warn.callCount, 0);
            assert.equal(mockConsole.error.callCount, 0);
          }
        }

        return {
          passing() {
            runTest({});
          },

          'threshold warning'() {
            runTest({ warn: { mean: 5 } }, 'warn');
          },

          'threshold error'() {
            runTest({ warn: { mean: 1 }, fail: { mean: 5 } }, 'fail');
          }
        };
      })()
    }
  }
});
