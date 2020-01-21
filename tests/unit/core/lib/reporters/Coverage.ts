import { mockImport } from 'tests/support/mockUtil';
import { Context } from 'istanbul-lib-report';
import { CoverageMap } from 'istanbul-lib-coverage';
import { spy, stub } from 'sinon';
import _Coverage, { CoverageOptions } from 'src/core/lib/reporters/Coverage';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

interface FullCoverage extends _Coverage {
  new (executor: Node, options: CoverageOptions): _Coverage;
}

registerSuite('core/lib/reporters/Coverage', function() {
  const mockExecutor = <any>{
    formatError: spy(),
    on: spy(),
    sourceMapStore: {
      transformCoverage: spy(() => {
        return { map: {} };
      })
    }
  };

  const mockGlobal: { [name: string]: any } = {};
  const mockVisit = spy();
  const mockSummarizers = {
    pkg: spy(() => {
      return { visit: mockVisit };
    })
  };
  const mockCreate = spy();
  const mockCreateCoverageMap = stub().returns({});

  let Coverage: FullCoverage;

  return {
    async before() {
      const coverageMod = await mockImport(
        () => import('src/core/lib/reporters/Coverage'),
        replace => {
          replace(() => import('src/common')).with({ global: mockGlobal });
          replace(() => import('istanbul-lib-coverage')).with({
            createCoverageMap: mockCreateCoverageMap
          });
          replace(() => import('istanbul-lib-report')).with({
            createContext() {
              return {} as Context;
            },
            summarizers: mockSummarizers as any
          });
          replace(() => import('istanbul-reports')).with({
            create: mockCreate
          });
        }
      );

      Coverage = (coverageMod.default as unknown) as FullCoverage;
    },

    beforeEach() {
      mockExecutor.formatError.reset();
      mockExecutor.on.reset();
      mockCreate.resetHistory();
      mockVisit.resetHistory();
      mockCreateCoverageMap.reset();
    },

    tests: {
      construct() {
        const watermarks = <any>{};
        const reporter = new Coverage(mockExecutor, <any>{
          filename: 'foo',
          watermarks
        });
        assert.propertyVal(reporter, 'filename', 'foo');
        assert.propertyVal(reporter, 'watermarks', watermarks);
      },

      '#createCoverageReport': {
        'without data'() {
          mockExecutor.coverageMap = { files: () => [] };
          const reporter = new Coverage(mockExecutor, <any>{});
          reporter.createCoverageReport('text', {});
          assert.equal(mockVisit.callCount, 1);
          assert.equal(mockCreateCoverageMap.callCount, 1);
          assert.equal(mockCreate.callCount, 1);
          assert.equal(
            mockCreate.getCall(0).args[0],
            'text',
            'report should be text by default'
          );
        },

        'with data'() {
          mockExecutor.coverageMap = { files: () => [] };
          const reporter = new Coverage(mockExecutor, <any>{});
          reporter.createCoverageReport('json', <CoverageMap>{
            files() {}
          });
          assert.equal(mockVisit.callCount, 1);
          assert.equal(mockCreateCoverageMap.callCount, 0);
          assert.equal(mockCreate.callCount, 1);
          assert.equal(
            mockCreate.getCall(0).args[0],
            'json',
            'report should be assigned value'
          );
        }
      },

      '#getReporterOptions': {
        'filename included'() {
          const reporter = new Coverage(<any>{ on() {} }, {
            filename: 'foo'
          });
          assert.deepEqual(reporter.getReporterOptions(), {
            file: 'foo'
          });
        },

        'filename not included'() {
          const reporter = new Coverage(<any>{ on() {} }, {});
          assert.deepEqual(reporter.getReporterOptions(), {
            file: undefined
          });
        }
      },

      '#runEnd': {
        'without data'() {
          const reporter = new Coverage(mockExecutor, <any>{});
          const create = stub(reporter, 'createCoverageReport');
          mockExecutor.coverageMap = { files: () => [] };
          reporter.runEnd();
          assert.equal(create.callCount, 0);
        },

        'with data'() {
          mockExecutor.coverageMap = {};
          const reporter = new Coverage(mockExecutor, <any>{});
          const create = stub(reporter, 'createCoverageReport');
          mockExecutor.coverageMap = { files: () => ['foo.js'] };
          reporter.runEnd();
          assert.equal(create.callCount, 1);
          assert.equal(create.getCall(0).args[0], undefined);
          assert.equal(create.getCall(0).args[1], mockExecutor.coverageMap);
        }
      }
    }
  };
});
