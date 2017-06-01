import Task from '@dojo/core/async/Task';
import { stub, SinonStub, spy, SinonSpy } from 'sinon';
import global from '@dojo/core/global';

const { registerSuite } = intern.getInterface('object');
const assert = intern.getAssertions('assert');
const { removeMocks, requireWithMocks } = intern.getPlugin<mocking.Mocking>('mocking');

registerSuite('bin/intern', function () {
	const mockNodeUtil: { [name: string]: SinonSpy } = {
		getConfig: spy(() => {
			return Task.resolve(configData);
		})
	};

	const mockCommonUtil: { [name: string]: SinonSpy } = {
		getConfigDescription: spy(() => {
			return 'foo';
		})
	};

	let configData: any;
	let logStub: SinonStub | undefined;
	const globalIntern = global.intern;
	const originalExitCode = process.exitCode;

	return {
		beforeEach() {
			Object.keys(mockNodeUtil).forEach(key => mockNodeUtil[key].reset());
			Object.keys(mockCommonUtil).forEach(key => mockCommonUtil[key].reset());
			configData = {};
		},

		afterEach() {
			removeMocks();
			if (logStub) {
				logStub.restore();
				logStub = undefined;
			}
			global.intern = globalIntern;
			process.exitCode = originalExitCode;
		},

		tests: {
			'basic run'() {
				return requireWithMocks(require, 'src/bin/intern', {
					'src/lib/node/runner': { default: () => Task.resolve() },
					'src/lib/node/util': mockNodeUtil,
					'src/lib/common/util': mockCommonUtil
				}).then(() => {
					assert.equal(mockNodeUtil.getConfig.callCount, 1);
					assert.equal(mockCommonUtil.getConfigDescription.callCount, 0);
				});
			},

			'show configs'() {
				configData = { showConfigs: true };
				logStub = stub(console, 'log');

				return requireWithMocks(require, 'src/bin/intern', {
					'src/lib/node/runner': { default: () => Task.resolve() },
					'src/lib/node/util': mockNodeUtil,
					'src/lib/common/util': mockCommonUtil
				}).then(() => {
					assert.equal(mockNodeUtil.getConfig.callCount, 1);
					assert.equal(mockCommonUtil.getConfigDescription.callCount, 1);
					assert.equal(logStub!.callCount, 1, 'expected log to be called once');
					assert.equal(logStub!.getCall(0).args[0], 'foo', 'unexpected description');
				});
			},

			'bad run': {
				'intern defined'() {
					const origExitCode = process.exitCode;
					logStub = stub(console, 'error');

					return requireWithMocks(require, 'src/bin/intern', {
						'src/lib/node/runner': { default: () => Task.reject(new Error('fail')) },
						'src/lib/node/util': mockNodeUtil,
						'src/lib/common/util': mockCommonUtil
					}).then(() => {
						process.exitCode = origExitCode;
						assert.equal(logStub!.callCount, 0, 'expected error not to be called');
					});
				},

				'intern not defined'() {
					const messageLogged = new Promise(resolve => {
						logStub = stub(console, 'error').callsFake(resolve);
					});
					global.intern = undefined;

					return requireWithMocks(require, 'src/bin/intern', {
						'src/lib/node/runner': { default: () => Task.reject(new Error('fail')) },
						'src/lib/node/util': mockNodeUtil,
						'src/lib/common/util': mockCommonUtil
					}).then(() => {
						return messageLogged;
					}).then(() => {
						assert.equal(logStub!.callCount, 1, 'expected error to be called once');
					});
				}
			}
		}
	};
});
