import { spy, SinonSpy } from 'sinon';
import * as tty from 'tty';

import RemoteSuite from 'src/core/lib/RemoteSuite';
import Suite from 'src/core/lib/Suite';
import _Pretty, { Result, Report } from 'src/core/lib/reporters/Pretty';

import {
  createMockCharm,
  createMockCoverageMap,
  createMockNodeExecutor
} from 'tests/support/unit/mocks';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('src/core/lib/reporters/Pretty', () => {
  return {
    before() {
      return mockRequire(require, 'src/core/lib/reporters/Pretty', {
        charm: createMockCharm,
        'istanbul-lib-coverage': {
          createCoverageMap: createMockCoverageMap
        },
        'src/common': {
          global: {
            process: {
              stdout: {
                columns: stdout.columns,
                rows: stdout.rows,
                on() {}
              }
            },
            setTimeout,
            clearTimeout
          }
        }
      }).then(resource => {
        removeMocks = resource.remove;
        Pretty = resource.module.default;
      });
    },

    beforeEach() {
      pretty = new Pretty(createMockNodeExecutor());
      pretty.createCoverageReport = spy(() => {});
    },

    afterEach() {
      pretty.close();
    },

    after() {
      removeMocks();
    },

    tests: {
      runStart() {
        pretty.dimensions = {
          width: 0,
          height: 0
        };

        pretty.runStart();
        const mockCharm = <any>pretty['_charm'];

        assert.equal(
          pretty.dimensions.width,
          stdout.columns || 80,
          'expected dimensions to use console width'
        );
        assert.equal(
          pretty.dimensions.height,
          stdout.rows || 24,
          'expected dimensions to use console height'
        );

        assert.equal(
          mockCharm.erase.callCount,
          1,
          'expected screen to be erased'
        );
        assert.equal(
          mockCharm.position.callCount,
          1,
          'expected cursor position to be set'
        );
        assert.deepEqual(
          mockCharm.position.args[0],
          [0, 0],
          'expected cursor position to be set to 0, 0'
        );

        const statusText = [
          ['Total: '],
          ['Pending'],
          ['\nPassed: 0  Failed: 0  Skipped: 0\n']
        ];

        assert.deepEqual(mockCharm.write.args, statusText);

        const dfd = this.async();
        setTimeout(
          dfd.callback(() => {
            assert.equal(
              mockCharm.write.callCount,
              statusText.length * 3,
              'expected status text to be written two more times'
            );
          }),
          500
        );
      },

      runEnd: {
        'no tests'() {
          pretty.runStart();
          const mockCharm = <any>pretty['_charm'];
          mockCharm.write.reset();

          pretty.runEnd();
          pretty.close();

          assert.equal(mockCharm.write.callCount, 4);
          assert.deepEqual(mockCharm.write.args, [
            ['\n'],
            ['Total: '],
            ['Pending'],
            ['\nPassed: 0  Failed: 0  Skipped: 0\n']
          ]);
        },

        'some tests'() {
          pretty.runStart();
          const mockCharm = <any>pretty['_charm'];

          pretty.testEnd(<any>{
            id: 'foo - skipped',
            skipped: 'yes'
          });
          pretty.testEnd(<any>{
            id: 'foo - failed',
            error: new Error('failed')
          });
          pretty.testEnd(<any>{
            id: 'foo - passed'
          });
          mockCharm.write.reset();

          // Add a file to the total report so the reporter will try
          // to create a coverage report
          (<any>pretty['_total'].coverageMap)._files = ['foo.js'];

          pretty.runEnd();
          pretty.close();

          assert.equal(
            mockCharm.write.callCount,
            8,
            'unexpected number of writes to charm'
          );
          assert.match(mockCharm.write.args[0][0], /foo - passed/);
          assert.match(mockCharm.write.args[1][0], /foo - skipped: yes/);
          assert.match(
            mockCharm.write.args[2][0],
            /foo - failed[^]Error: failed/
          );
          assert.deepEqual(mockCharm.write.args.slice(3), [
            ['\n'],
            ['Total: '],
            ['Pending'],
            ['\nPassed: 1  Failed: 1  Skipped: 1\n'],
            ['\n']
          ]);
          assert.equal(
            (<SinonSpy>pretty.createCoverageReport).callCount,
            1,
            'coverage report should have been created'
          );
        }
      },

      coverage() {
        const report = pretty['_getReport']({ sessionId: 'foo' } as Suite);
        pretty.coverage({
          sessionId: 'foo',
          coverage: { functions: 5 }
        });
        assert.equal(
          (report.coverageMap.merge as SinonSpy).callCount,
          1,
          'coverage data should have been merged into report'
        );
        assert.deepEqual(
          report.coverageMap.data,
          { functions: 5 } as any,
          'expected coverage data to have been merged into sourcemap'
        );
      },

      suiteStart() {
        const suite = <any>{
          hasParent: false,
          numTests: 3,
          sessionId: 'foo'
        };

        pretty.runStart();
        pretty.suiteStart(suite);
        const fooReport = pretty['_getReport'](suite);
        assert.equal(
          fooReport.numTotal,
          3,
          'expected suite report to include suite test count'
        );
        assert.equal(
          pretty['_total'].numTotal,
          3,
          'expected total report to include suite test count'
        );

        suite.sessionId = 'bar';
        pretty.suiteStart(suite);
        const barReport = pretty['_getReport'](suite);
        assert.equal(
          barReport.numTotal,
          3,
          'expected suite report to include suite test count'
        );
        assert.equal(
          pretty['_total'].numTotal,
          6,
          'expected total report to include suite test count'
        );

        suite.hasParent = true;
        pretty.suiteStart(suite);
        assert.equal(
          barReport.numTotal,
          3,
          'expected report test count to be unchanged'
        );

        const remoteSuite = new RemoteSuite({
          parent: <any>{
            name: 'parent-foo',
            sessionId: 'bar'
          },
          name: 'foo'
        });
        remoteSuite.tests = [<any>{}, <any>{}];
        pretty.suiteStart(remoteSuite);
        assert.equal(barReport.numTotal, 5, 'unexpected report test count');
      },

      suiteEnd() {
        const suite = <any>{
          hasParent: false,
          numTests: 3,
          sessionId: 'foo',
          id: 'bar',
          error: new Error('fail'),
          remote: getRemote()
        };

        // Get the report to initialize it
        const fooReport = pretty['_getReport'](suite);
        fooReport.suiteInfo[suite.id] = {
          parentId: undefined,
          numToReport: suite.numTests - 1
        };

        pretty.runStart();
        pretty.suiteEnd(suite);

        assert.equal(
          fooReport.numSkipped,
          2,
          'should have reported unrun tests ask skipped'
        );
        assert.equal(
          pretty['_total'].numSkipped,
          2,
          'should have reported unrun tests ask skipped'
        );
      },

      testEnd: (() => {
        function runTest(test: any) {
          pretty.runStart();

          // Get the report to initialize it
          const fooReport = pretty['_getReport'](test);
          pretty.testEnd(test);

          let testType: string;
          let marker: string;

          if (test.error) {
            testType = 'numFailed';
            marker = '×';
          } else if (test.skipped) {
            testType = 'numSkipped';
            marker = '~';
          } else {
            testType = 'numPassed';
            marker = '✓';
          }

          assert.equal(
            fooReport[testType as keyof Report],
            1,
            'expected suite report to include suite test count'
          );

          const totalReport: typeof fooReport = pretty['_total'];
          assert.equal(
            totalReport[testType as keyof Report],
            1,
            'expected total report to include suite test count'
          );

          const message = pretty['_log'][0];
          assert.match(message, new RegExp(`^${marker} ${test.id}`));
        }

        return {
          passed() {
            runTest({
              id: 'good test',
              sessionId: 'foo'
            });
          },

          failed() {
            runTest({
              id: 'bad test',
              sessionId: 'foo',
              error: new Error('fail')
            });
          },

          skipped() {
            runTest({
              id: 'skipped test',
              sessionId: 'foo',
              skipped: 'yes'
            });
          }
        };
      })(),

      tunnelDownloadProgress() {
        pretty.tunnelDownloadProgress(<any>{
          progress: {
            received: 10,
            total: 40
          }
        });
        assert.match(pretty.tunnelState, /^Downloading 25.00%/);
      },

      tunnelStatus() {
        pretty.tunnelStatus(<any>{ status: 'running' });
        assert.equal(pretty.tunnelState, 'running');
      },

      error() {
        pretty.runStart();
        const mockCharm = <any>pretty['_charm'];
        mockCharm.erase.reset();

        pretty.error(new Error('failed'));

        assert.match(pretty['_log'][0], /^! failed/);

        const dfd = this.async();
        setTimeout(
          dfd.callback(() => {
            assert.equal(
              mockCharm.erase.callCount,
              0,
              'did not expect screen to be redrawn'
            );
          }),
          400
        );
      },

      deprecated() {
        pretty.deprecated({
          original: 'foo',
          replacement: 'bar',
          message: 'it was replaced'
        });
        assert.match(
          pretty['_log'][0],
          /foo is deprecated. Use bar instead. it was replaced/
        );
      },

      rendering() {
        pretty.runStart();
        const mockCharm = <any>pretty['_charm'];

        // Get/create a report so the renderer will do something
        const report = pretty['_getReport']({
          sessionId: 'foo',
          remote: {
            environmentType: {
              browserName: 'node',
              version: '8.5.0',
              platform: 'MAC'
            }
          }
        } as Suite);

        // Set a total value so the progress bar will draw
        report.numTotal = 3;

        report.record(Result.PASS);
        report.record(Result.FAIL);
        report.record(Result.SKIP);

        const dfd = this.async();
        setTimeout(
          dfd.callback(() => {
            pretty.close();
            assert.deepEqual(mockCharm.write.args, [
              ['Total: '],
              ['Pending'],
              ['\nPassed: 0  Failed: 0  Skipped: 0\n'],
              ['Total: '],
              ['Pending'],
              ['\nPassed: 0  Failed: 0  Skipped: 0\n'],
              ['\n'],
              ['node 8 MAC: '],
              // Progress bar
              ['['],
              ['✓'],
              ['×'],
              ['~'],
              ['] 3/3'],
              [', 1 fail, 1 skip\n']
            ]);
          }),
          400
        );
      }
    }
  };
});

let pretty: _Pretty;
let Pretty: typeof _Pretty;
let removeMocks: () => void;

const stdout = <tty.WriteStream>process.stdout;

function getRemote() {
  return {
    environmentType: {
      browserName: 'node',
      version: '8.5.0',
      platform: 'MAC'
    }
  };
}
