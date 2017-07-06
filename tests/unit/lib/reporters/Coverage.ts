import _Coverage, { CoverageProperties } from 'src/lib/reporters/Coverage';
import { spy, stub } from 'sinon';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');
const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

interface FullCoverage extends _Coverage {
	new (executor: Node, options: CoverageProperties): _Coverage;
}

registerSuite('lib/reporters/Coverage', function () {
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
		pkg: spy(() => { return { visit: mockVisit }; })
	};
	const mockCreate = spy();
	const mockCreateCoverageMap = stub().returns({});

	let Coverage: FullCoverage;
	let removeMocks: () => void;

	return {
		before() {
			return mockRequire(require, 'src/lib/reporters/Coverage', {
				'@dojo/shim/global': { default: mockGlobal },
				'istanbul-lib-coverage': { createCoverageMap: mockCreateCoverageMap },
				'istanbul-lib-report': {
					createContext() { return {}; },
					summarizers: mockSummarizers
				},
				'istanbul-reports': { create: mockCreate }
			}).then(handle => {
				removeMocks = handle.remove;
				Coverage = handle.module.default;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			mockExecutor.formatError.reset();
			mockExecutor.on.reset();
			mockCreate.reset();
			mockVisit.reset();
			mockCreateCoverageMap.reset();
		},

		tests: {
			construct() {
				const watermarks = <any>{};
				const reporter = new Coverage(mockExecutor, <any>{ filename: 'foo', watermarks });
				assert.propertyVal(reporter, 'filename', 'foo');
				assert.propertyVal(reporter, 'watermarks', watermarks);
			},

			'#createCoverageReport': {
				'without data'() {
					const reporter = new Coverage(mockExecutor, <any>{});
					reporter.createCoverageReport('text', {});
					assert.equal(mockVisit.callCount, 1);
					assert.equal(mockCreateCoverageMap.callCount, 1);
					assert.equal(mockCreate.callCount, 1);
					assert.equal(mockCreate.getCall(0).args[0], 'text', 'report should be text by default');
				},

				'with data'() {
					const reporter = new Coverage(mockExecutor, <any>{});
					reporter.createCoverageReport('json', { files() { } });
					assert.equal(mockVisit.callCount, 1);
					assert.equal(mockCreateCoverageMap.callCount, 0);
					assert.equal(mockCreate.callCount, 1);
					assert.equal(mockCreate.getCall(0).args[0], 'json', 'report should be assigned value');
				}
			},

			'#runEnd': {
				'without data'() {
					const reporter = new Coverage(mockExecutor, <any>{});
					const create = stub(reporter, 'createCoverageReport');
					reporter.runEnd();
					assert.equal(create.callCount, 1);
					assert.equal(create.getCall(0).args[0], 'text');
					assert.isUndefined(create.getCall(0).args[1]);
				},

				'with data'() {
					mockExecutor.coverageMap = {};
					const reporter = new Coverage(mockExecutor, <any>{});
					const create = stub(reporter, 'createCoverageReport');
					reporter.runEnd();
					assert.equal(create.callCount, 1);
					assert.equal(create.getCall(0).args[0], 'text');
					assert.equal(create.getCall(0).args[1], mockExecutor.coverageMap);
				}
			}
		}
	};
});
