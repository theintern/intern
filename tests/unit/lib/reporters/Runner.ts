import { spy, stub } from 'sinon';
import _Runner from 'src/lib/reporters/Runner';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');
const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/reporters/Runner', function() {
	const mockCharm = {
		foreground: spy(() => mockCharm),
		pipe: spy(() => mockCharm),
		display: spy(() => mockCharm),
		write: spy(() => true)
	};

	const mockExecutor = <any>{
		formatError: spy((error: Error) => error.message),
		on: spy(() => {}),
		config: { serveOnly: false }
	};

	const mockCoverageMap = { merge: spy() };
	const mockCreateCoverageMap = stub().returns(mockCoverageMap);

	let Runner: typeof _Runner;
	let removeMocks: () => void;

	return {
		before() {
			return mockRequire(require, 'src/lib/reporters/Runner', {
				'istanbul-lib-coverage': {
					createCoverageMap: mockCreateCoverageMap
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
			mockExecutor.formatError.reset();
			mockExecutor.on.reset();
			mockCoverageMap.merge.reset();
			mockCreateCoverageMap.reset();
			mockCreateCoverageMap.returns(mockCoverageMap);
			mockCharm.write.reset();
		},

		tests: {
			construct() {
				const reporter = new Runner(mockExecutor, { hidePassed: true });
				assert.isDefined(reporter);
				assert.isFalse(reporter.serveOnly);
				assert.isTrue(reporter.hidePassed);
			},

			'#coverage'() {
				const reporter = new Runner(mockExecutor);
				reporter.sessions['bar'] = <any>{};
				reporter.coverage({
					sessionId: 'bar',
					coverage: { 'foo.js': {} }
				});
				assert.equal(mockCoverageMap.merge.callCount, 1);
				assert.deepEqual(mockCoverageMap.merge.getCall(0).args[0], {
					'foo.js': {}
				});
			},

			'#deprecated'() {
				const reporter = new Runner(mockExecutor);
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

			'#error'() {
				const reporter = new Runner(mockExecutor);
				assert.isFalse(reporter.hasRunErrors);
				reporter.error(new Error('fail'));
				assert.isTrue(reporter.hasRunErrors);
				const text = mockCharm.write.getCalls().reduce((text, call) => {
					return text + call.args.join('');
				}, '');
				assert.match(text, /fail/);
			},

			'#log'() {
				const mockConsole = { log: spy() };
				const reporter = new Runner(mockExecutor, {
					console: <any>mockConsole
				});
				assert.equal(mockConsole.log.callCount, 0);
				reporter.log('foo');
				assert.equal(mockConsole.log.callCount, 1);
				assert.equal(mockConsole.log.getCall(0).args[0], 'DEBUG: foo');
			}
		}
	};
});
