import { createSandbox, spy } from 'sinon';
import _Runner from 'src/lib/reporters/Runner';
import {
  MockConsole,
  MockCoverageMap,
  createMockCharm,
  createMockConsole,
  createMockCoverageMap,
  createMockNodeExecutor,
} from '../../../support/unit/mocks';

import { TunnelMessage } from '../../../../src/lib/executors/Node';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');
const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/reporters/Runner', function () {
  const sandbox = createSandbox();
  const mockCharm = createMockCharm();
  const mockExecutor = createMockNodeExecutor();

  mockExecutor.config.serveOnly = false;

  let Runner: typeof _Runner;
  let removeMocks: () => void;
  let reporter: _Runner;

  return {
    before() {
      return mockRequire(require, 'src/lib/reporters/Runner', {
        'istanbul-lib-coverage': {
          createCoverageMap: createMockCoverageMap,
        },
        charm: () => mockCharm,
      }).then((handle) => {
        removeMocks = handle.remove;
        Runner = handle.module.default;
      });
    },

    after() {
      removeMocks();
    },

    beforeEach() {
      sandbox.resetHistory();
      mockCharm._reset();
      reporter = new Runner(mockExecutor, {
        hidePassed: true,
        console: <any>createMockConsole(),
      });
    },

    tests: {
      construct() {
        assert.isDefined(reporter);
        assert.isFalse(reporter.serveOnly);
        assert.isTrue(reporter.hidePassed);
        assert.isFalse(reporter.hideTunnelDownloadProgress);
      },

      coverage() {
        reporter.sessions['bar'] = <any>{};
        reporter.coverage({
          sessionId: 'bar',
          coverage: { 'foo.js': {} },
        });
        const coverageMap: MockCoverageMap = <any>(
          reporter.sessions['bar'].coverage
        );
        assert.equal(coverageMap.merge.callCount, 1);
        assert.deepEqual(coverageMap.merge.getCall(0).args[0], {
          'foo.js': {},
        });
      },

      deprecated() {
        reporter.deprecated({
          original: 'foo',
          replacement: 'bar',
          message: "don't mix them",
        });
        assert.equal(mockCharm.write.callCount, 4);
        assert.match(mockCharm.write.getCall(0).args[0], /is deprecated/);

        // Send the same message again -- should be ignored
        reporter.deprecated({
          original: 'foo',
          replacement: 'bar',
          message: "don't mix them",
        });
        assert.equal(mockCharm.write.callCount, 4, 'expected no new writes');

        // Send the same message again -- should be ignored
        reporter.deprecated({
          original: 'bar',
          message: "don't mix them",
        });
        assert.equal(mockCharm.write.callCount, 8);
        assert.match(mockCharm.write.getCall(5).args[0], /open a ticket/);
      },

      error() {
        assert.isFalse(reporter.hasRunErrors);
        reporter.error(new Error('fail'));
        assert.isTrue(reporter.hasRunErrors);
        const text = mockCharm.write.getCalls().reduce((text, call) => {
          return text + call.args.join('');
        }, '');
        assert.match(text, /fail/);
      },

      warning() {
        reporter.warning('oops');
        assert.deepEqual(mockCharm.write.args[0], ['WARNING: oops']);
      },

      log() {
        const mockConsole: MockConsole = <any>reporter.console;
        assert.equal(mockConsole.log.callCount, 0);
        reporter.log('foo');
        assert.equal(mockConsole.log.callCount, 1);
        assert.equal(mockConsole.log.getCall(0).args[0], 'DEBUG: foo');
      },

      runEnd: {
        normal() {
          const coverageMap: MockCoverageMap = createMockCoverageMap();
          (<any>reporter.executor).coverageMap = <any>coverageMap;
          reporter.sessions['bar'] = <any>{
            suite: {
              numTests: 2,
              numPassedTests: 0,
              numFailedTests: 1,
              numSkippedTests: 1,
            },
          };
          reporter.createCoverageReport = spy(() => Promise.resolve());
          coverageMap._files = ['foo.js'];
          reporter.runEnd();

          assert.equal(
            (<any>reporter.createCoverageReport).callCount,
            1,
            'expected coverage report to be generated'
          );

          assert.deepEqual(mockCharm.write.args, [
            ['\n'],
            // This line is because we have files
            ['Total coverage\n'],
            ['TOTAL: tested 1 platforms, 0 passed, 1 failed, 1 skipped'],
            ['\n'],
          ]);
        },

        'run error'() {
          const coverageMap: MockCoverageMap = createMockCoverageMap();
          (<any>reporter.executor).coverageMap = <any>coverageMap;
          reporter.sessions['bar'] = <any>{
            suite: {
              numTests: 2,
              numPassedTests: 1,
              numFailedTests: 1,
              numSkippedTests: 0,
            },
          };
          reporter.hasRunErrors = true;
          reporter.createCoverageReport = spy(() => Promise.resolve());
          coverageMap._files = ['foo.js'];
          reporter.runEnd();

          assert.equal(
            (<any>reporter.createCoverageReport).callCount,
            1,
            'expected coverage report to be generated'
          );

          assert.deepEqual(mockCharm.write.args, [
            ['\n'],
            // This line is because we have files
            ['Total coverage\n'],
            [
              'TOTAL: tested 1 platforms, 1 passed, 1 failed; fatal error occurred',
            ],
            ['\n'],
          ]);
        },

        'suite error'() {
          const coverageMap: MockCoverageMap = createMockCoverageMap();
          (<any>reporter.executor).coverageMap = <any>coverageMap;
          reporter.sessions['bar'] = <any>{
            suite: {
              numTests: 2,
              numPassedTests: 2,
              numFailedTests: 0,
              numSkippedTests: 0,
            },
          };
          reporter.hasSuiteErrors = true;
          reporter.createCoverageReport = spy(() => Promise.resolve());
          coverageMap._files = ['foo.js'];
          reporter.runEnd();

          assert.equal(
            (<any>reporter.createCoverageReport).callCount,
            1,
            'expected coverage report to be generated'
          );

          assert.deepEqual(mockCharm.write.args, [
            ['\n'],
            // This line is because we have files
            ['Total coverage\n'],
            [
              'TOTAL: tested 1 platforms, 2 passed, 0 failed; suite error occurred',
            ],
            ['\n'],
          ]);
        },
      },

      serverStart: {
        'no websocket'() {
          reporter.serverStart(<any>{ port: 12345 });
          assert.deepEqual(mockCharm.write.args, [
            ['Listening on localhost:12345\n'],
          ]);
        },

        websocket() {
          reporter.serverStart(<any>{
            port: 12345,
            socketPort: 54321,
          });
          assert.deepEqual(mockCharm.write.args, [
            ['Listening on localhost:12345 (ws 54321)\n'],
          ]);
        },
      },

      suiteEnd: {
        'missing session'() {
          reporter.suiteEnd(<any>{ sessionId: 'bar' });
          assert.deepEqual(mockCharm.write.args, [
            ['BUG: suiteEnd was received for invalid session bar'],
            ['\n'],
          ]);
        },

        'suite error'() {
          reporter.sessions[''] = <any>{};
          reporter.suiteEnd(<any>{
            id: 'foo',
            error: new Error('failed'),
          });
          assert.deepEqual(mockCharm.write.args, [
            ['Suite foo ERROR\n'],
            ['Error: failed'],
            ['\n'],
          ]);
          assert.isTrue(
            reporter.hasSuiteErrors,
            'reporter should indicate that there were suite errors'
          );
        },

        'multiple suites': (() => {
          let suite: any;
          let session: any;

          return {
            beforeEach() {
              reporter.sessions[''] = session = <any>{};
              (<any>reporter.executor).suites = ['foo.js', 'bar.js'];
              suite = {
                id: 'foo',
                name: 'foo',
                numTests: 2,
                numPassedTests: 2,
                numFailedTests: 0,
                numSkippedTests: 0,
              };
            },

            tests: {
              coverage() {
                session.coverage = {};
                const createCoverageReport = spy(() => Promise.resolve());
                reporter.createCoverageReport = createCoverageReport;
                reporter.suiteEnd(suite);
                assert.equal(createCoverageReport.callCount, 1);
                assert.deepEqual(mockCharm.write.args, [
                  ['\n'],
                  ['foo: 2 passed, 0 failed'],
                  ['\n'],
                ]);
              },

              'no coverage'() {
                reporter.suiteEnd(suite);
                assert.deepEqual(mockCharm.write.args, [
                  ['No unit test coverage for foo'],
                  ['\n'],
                  ['foo: 2 passed, 0 failed'],
                  ['\n'],
                ]);
              },

              skipped() {
                suite.numSkippedTests = 1;
                reporter.suiteEnd(suite);
                assert.deepEqual(mockCharm.write.args, [
                  ['No unit test coverage for foo'],
                  ['\n'],
                  ['foo: 1 passed, 0 failed, 1 skipped'],
                  ['\n'],
                ]);
              },

              error() {
                session.hasSuiteErrors = true;
                reporter.suiteEnd(suite);
                assert.deepEqual(mockCharm.write.args, [
                  ['No unit test coverage for foo'],
                  ['\n'],
                  ['foo: 2 passed, 0 failed; suite error occurred'],
                  ['\n'],
                ]);
              },
            },
          };
        })(),
      },

      suiteStart() {
        reporter.sessions['foo'] = <any>{};
        reporter.suiteStart(<any>{
          sessionId: 'foo',
          name: 'bar',
        });
        assert.deepEqual(mockCharm.write.args, [
          ['\n'],
          ['‣ Created remote session bar (foo)\n'],
        ]);
      },

      testEnd: {
        error() {
          reporter.testEnd(<any>{
            error: new Error('failed'),
            id: 'foo',
            timeElapsed: 123,
          });
          assert.deepEqual(mockCharm.write.args, [
            ['× foo'],
            [' (0.123s)'],
            ['\n'],
            ['    Error: failed'],
            ['\n\n'],
          ]);
        },

        skipped: {
          hidden() {
            reporter.hideSkipped = true;
            reporter.testEnd(<any>{
              skipped: 'yes',
              id: 'foo',
            });
            assert.deepEqual(mockCharm.write.args, []);
          },

          shown() {
            reporter.testEnd(<any>{
              skipped: 'yes',
              id: 'foo',
            });
            assert.deepEqual(mockCharm.write.args, [
              ['~ foo'],
              [' (yes)'],
              ['\n'],
            ]);
          },
        },

        passed: {
          hidden() {
            reporter.testEnd(<any>{
              id: 'foo',
            });
            assert.deepEqual(mockCharm.write.args, []);
          },

          shown() {
            reporter.hidePassed = false;
            reporter.testEnd(<any>{
              id: 'foo',
              timeElapsed: 123,
            });
            assert.deepEqual(mockCharm.write.args, [
              ['✓ foo'],
              [' (0.123s)'],
              ['\n'],
            ]);
          },
        },
      },

      tunnelDownloadProgress() {
        const progress = { received: 10, total: 50 };
        reporter.tunnelDownloadProgress(<any>{ progress });
        assert.deepEqual(mockCharm.write.args, [
          [
            `Tunnel download: ${(
              (progress.received / progress.total) *
              100
            ).toFixed(3)}%\r`,
          ],
        ]);
      },

      hideTunnelDownloadProgress() {
        reporter.hideTunnelDownloadProgress = true;
        const progress = { received: 10, total: 50 };
        reporter.tunnelDownloadProgress(<any>{ progress });

        assert.equal(mockCharm.write.callCount, 0);
      },

      tunnelStart() {
        reporter.tunnelStart(<TunnelMessage>{});
        assert.deepEqual(mockCharm.write.args, [['Tunnel started\n']]);
      },

      tunnelStatus() {
        reporter.tunnelStatus(<any>{ status: 'fine' });
        assert.deepEqual(mockCharm.write.args, [['fine\x1b[K\r']]);
      },
    },
  };
});
