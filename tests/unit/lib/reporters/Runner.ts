import { sandbox as Sandbox, spy } from 'sinon';
import _Runner from 'src/lib/reporters/Runner';
import {
	MockConsole,
	MockCoverageMap,
	createMockCharm,
	createMockConsole,
	createMockCoverageMap,
	createMockNodeExecutor
} from '../../../support/unit/mocks';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');
const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/reporters/Runner', function() {
	const sandbox = Sandbox.create();
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
					createCoverageMap: createMockCoverageMap
				},
				charm: () => mockCharm
			}).then(handle => {
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
				console: <any>createMockConsole()
			});
		},

		tests: {
			construct() {
				assert.isDefined(reporter);
				assert.isFalse(reporter.serveOnly);
				assert.isTrue(reporter.hidePassed);
			},

			coverage() {
				reporter.sessions['bar'] = <any>{};
				reporter.coverage({
					sessionId: 'bar',
					coverage: { 'foo.js': {} }
				});
				const coverageMap: MockCoverageMap = <any>reporter.sessions[
					'bar'
				].coverage;
				assert.equal(coverageMap.merge.callCount, 1);
				assert.deepEqual(coverageMap.merge.getCall(0).args[0], {
					'foo.js': {}
				});
			},

			deprecated() {
				reporter.deprecated({
					original: 'foo',
					replacement: 'bar',
					message: "don't mix them"
				});
				assert.equal(mockCharm.write.callCount, 4);
				assert.match(
					mockCharm.write.getCall(0).args[0],
					/is deprecated/
				);

				// Send the same message again -- should be ignored
				reporter.deprecated({
					original: 'foo',
					replacement: 'bar',
					message: "don't mix them"
				});
				assert.equal(
					mockCharm.write.callCount,
					4,
					'expected no new writes'
				);

				// Send the same message again -- should be ignored
				reporter.deprecated({
					original: 'bar',
					message: "don't mix them"
				});
				assert.equal(mockCharm.write.callCount, 8);
				assert.match(
					mockCharm.write.getCall(5).args[0],
					/open a ticket/
				);
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
							numFailedTests: 1,
							numSkippedTests: 0
						}
					};
					reporter.createCoverageReport = spy(() => {});
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
						['TOTAL: tested 1 platforms, 1 passed, 1 failed'],
						['\n']
					]);
				},

				'run errors'() {
					const coverageMap: MockCoverageMap = createMockCoverageMap();
					(<any>reporter.executor).coverageMap = <any>coverageMap;
					reporter.sessions['bar'] = <any>{
						suite: {
							numTests: 2,
							numFailedTests: 1,
							numSkippedTests: 0
						}
					};
					reporter.createCoverageReport = spy(() => {});
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
						['TOTAL: tested 1 platforms, 1 passed, 1 failed'],
						['\n']
					]);
				}
			}
		}
	};
});
