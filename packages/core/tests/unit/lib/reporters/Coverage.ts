import { mockImport } from 'tests/support/mockUtil';
import { Context } from 'istanbul-lib-report';
import { CoverageMap } from 'istanbul-lib-coverage';
import { createSandbox, stub } from 'sinon';
import _Coverage, { CoverageOptions } from 'src/lib/reporters/Coverage';

interface FullCoverage extends _Coverage {
  new (executor: Node, options: CoverageOptions): _Coverage;
}

registerSuite('lib/reporters/Coverage', function () {
  const sandbox = createSandbox();

  const mockExecutor = <any>{
    formatError: sandbox.spy(),
    on: sandbox.spy(),
    sourceMapStore: {
      transformCoverage: sandbox.spy(() => {
        return { map: {} };
      })
    }
  };

  const mockGlobal: { [name: string]: any } = {};
  const mockVisit = sandbox.spy();
  const mockSummarizers = {
    pkg: sandbox.spy(() => {
      return { visit: mockVisit };
    })
  };
  const mockCreate = sandbox.spy();
  const mockCreateCoverageMap = sandbox.stub().returns({});

  let Coverage: FullCoverage;

  return {
    async before() {
      const coverageMod = await mockImport(
        () => import('src/lib/reporters/Coverage'),
        replace => {
          replace(() => import('@theintern/common')).with({
            global: mockGlobal
          });
          replace(() => import('istanbul-lib-coverage')).with({
            createCoverageMap: mockCreateCoverageMap
          });
          replace(() => import('istanbul-lib-report')).with({
            createContext: () =>
              (({
                getTree: () => ({
                  visit: mockVisit
                })
              } as unknown) as Context),
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
      sandbox.resetHistory();
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
