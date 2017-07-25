import Task from '@dojo/core/async/Task';
import { stub, SinonStub, spy, SinonSpy } from 'sinon';
import global from '@dojo/shim/global';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');
const originalIntern = global.intern;

registerSuite('bin/intern', function () {
	const mockNodeUtil: { [name: string]: SinonSpy } = {
		getConfig: spy(() => {
			return Task.resolve(configData);
		})
	};

	const mockCommonUtil: { [name: string]: SinonStub } = {
		getConfigDescription: stub().returns('foo')
	};

	class MockNode {
		configure() {}
		run() {
			return Task.resolve();
		}
	}

	let configData: any;
	let logStub: SinonStub | undefined;
	const originalExitCode = process.exitCode;
	let removeMocks: (() => void) | undefined;

	return {
		beforeEach() {
			Object.keys(mockNodeUtil).forEach(key => mockNodeUtil[key].reset());
			Object.keys(mockCommonUtil).forEach(key => mockCommonUtil[key].reset());
			mockCommonUtil.getConfigDescription.returns('foo');
			configData = {};
		},

		afterEach() {
			if (removeMocks) {
				removeMocks();
				removeMocks = undefined;
			}

			if (logStub) {
				logStub.restore();
				logStub = undefined;
			}

			process.exitCode = originalExitCode;
			global.intern = originalIntern;
		},

		tests: {
			'basic run'() {
				return mockRequire(require, 'src/bin/intern', {
					'src/lib/executors/Node': { default: MockNode },
					'src/lib/node/util': mockNodeUtil,
					'src/lib/common/util': mockCommonUtil,
					'src/index': { default: () => {} }
				}).then(handle => {
					removeMocks = handle.remove;
					assert.equal(mockNodeUtil.getConfig.callCount, 1);
					assert.equal(mockCommonUtil.getConfigDescription.callCount, 0);
				});
			},

			'show configs'() {
				configData = { showConfigs: true };
				logStub = stub(console, 'log');

				return mockRequire(require, 'src/bin/intern', {
					'src/lib/executors/Node': { default: MockNode },
					'src/lib/node/util': mockNodeUtil,
					'src/lib/common/util': mockCommonUtil,
					'src/index': { default: () => {} }
				}).then(handle => {
					removeMocks = handle.remove;
					assert.equal(mockNodeUtil.getConfig.callCount, 1);
					assert.equal(mockCommonUtil.getConfigDescription.callCount, 1);
					assert.equal(logStub!.callCount, 1, 'expected log to be called once');
					assert.equal(logStub!.getCall(0).args[0], 'foo', 'unexpected description');
				});
			},

			'bad run': {
				'intern defined'() {
					logStub = stub(console, 'error');

					return mockRequire(require, 'src/bin/intern', {
						'src/lib/executors/Node': { default: MockNode },
						'src/lib/node/util': mockNodeUtil,
						'src/lib/common/util': mockCommonUtil,
						'src/index': { default: () => {} },
						'@dojo/shim/global': { default: { process: {} } }
					}).then(handle => {
						removeMocks = handle.remove;
						assert.equal(logStub!.callCount, 0, 'expected error not to be called');
					});
				},

				'intern not defined'() {
					const messageLogged = new Promise(resolve => {
						logStub = stub(console, 'error').callsFake(resolve);
					});

					configData = { showConfigs: true };
					mockCommonUtil.getConfigDescription.throws();

					return mockRequire(require, 'src/bin/intern', {
						'src/lib/executors/Node': { default: MockNode },
						'src/lib/node/util': mockNodeUtil,
						'src/lib/common/util': mockCommonUtil,
						'src/index': { default: () => {} },
						'@dojo/shim/global': { default: { process: { stdout: process.stdout } } }
					}).then(handle => {
						removeMocks = handle.remove;
						return messageLogged;
					}).then(() => {
						assert.equal(logStub!.callCount, 1, 'expected error to be called once');
					});
				}
			}
		}
	};
});
