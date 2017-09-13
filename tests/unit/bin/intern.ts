import Task from '@dojo/core/async/Task';
import { stub, SinonStub, spy, SinonSpy } from 'sinon';
import global from '@dojo/shim/global';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');
const originalIntern = global.intern;

registerSuite('bin/intern', function() {
	const mockNodeUtil: { [name: string]: SinonSpy } = {
		getConfig: spy(() => {
			return Task.resolve({ config: configData });
		})
	};

	const mockCommonUtil: { [name: string]: SinonStub } = {
		getConfigDescription: stub().returns('foo')
	};

	class MockNode {
		_config = {
			foo: 1,
			bar: { abc: 123 },
			baz: false
		};
		configure() {}
		run() {
			return Task.resolve();
		}
	}

	let configData: any;
	let logStub: SinonStub | undefined;
	let warnStub: SinonStub | undefined;
	const originalExitCode = process.exitCode;
	let removeMocks: (() => void) | undefined;

	return {
		beforeEach() {
			Object.keys(mockNodeUtil).forEach(key => mockNodeUtil[key].reset());
			Object.keys(mockCommonUtil).forEach(key =>
				mockCommonUtil[key].reset()
			);
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

			if (warnStub) {
				warnStub.restore();
				warnStub = undefined;
			}

			process.exitCode = originalExitCode;
			global.intern = originalIntern;
		},

		tests: {
			'basic run'() {
				warnStub = stub(console, 'warn');

				return mockRequire(require, 'src/bin/intern', {
					'src/lib/node/util': mockNodeUtil,
					'src/lib/common/util': mockCommonUtil,
					'src/index': { default: new MockNode() }
				}).then(handle => {
					removeMocks = handle.remove;
					assert.equal(mockNodeUtil.getConfig.callCount, 1);
					assert.equal(
						mockCommonUtil.getConfigDescription.callCount,
						0
					);
				});
			},

			'show configs'() {
				configData = { showConfigs: true };
				logStub = stub(console, 'log');

				return mockRequire(require, 'src/bin/intern', {
					'src/lib/node/util': mockNodeUtil,
					'src/lib/common/util': mockCommonUtil,
					'src/index': { default: new MockNode() }
				}).then(handle => {
					removeMocks = handle.remove;
					assert.equal(mockNodeUtil.getConfig.callCount, 1);
					assert.equal(
						mockCommonUtil.getConfigDescription.callCount,
						1
					);
					assert.equal(
						logStub!.callCount,
						1,
						'expected log to be called once'
					);
					assert.equal(
						logStub!.getCall(0).args[0],
						'foo',
						'unexpected description'
					);
				});
			},

			'bad run': {
				'intern defined'() {
					logStub = stub(console, 'error');
					warnStub = stub(console, 'warn');

					return mockRequire(require, 'src/bin/intern', {
						'src/lib/node/util': mockNodeUtil,
						'src/lib/common/util': mockCommonUtil,
						'src/index': { default: new MockNode() },
						'@dojo/shim/global': { default: { process: {} } }
					}).then(handle => {
						removeMocks = handle.remove;
						assert.equal(
							logStub!.callCount,
							0,
							'expected error not to be called'
						);
					});
				},

				'intern not defined'() {
					const messageLogged = new Promise(resolve => {
						logStub = stub(console, 'error').callsFake(resolve);
					});

					configData = { showConfigs: true };
					mockCommonUtil.getConfigDescription.throws();

					return mockRequire(require, 'src/bin/intern', {
						'src/lib/node/util': mockNodeUtil,
						'src/lib/common/util': mockCommonUtil,
						'src/index': { default: new MockNode() },
						'@dojo/shim/global': {
							default: { process: { stdout: process.stdout } }
						}
					})
						.then(handle => {
							removeMocks = handle.remove;
							return messageLogged;
						})
						.then(() => {
							assert.equal(
								logStub!.callCount,
								1,
								'expected error to be called once'
							);
						});
				}
			},

			help() {
				configData = { help: true };
				logStub = stub(console, 'log');

				return mockRequire(require, 'src/bin/intern', {
					'src/lib/node/util': mockNodeUtil,
					'src/lib/common/util': mockCommonUtil,
					'src/index': { default: new MockNode() }
				}).then(handle => {
					removeMocks = handle.remove;
					assert.isAbove(
						logStub!.callCount,
						1,
						'expected log to be called at least once'
					);
					const text = logStub!
						.getCalls()
						.map(call => call.args[0])
						.join('\n');
					assert.match(text, /foo\s+-\s+1/, 'unexpected description');
					assert.match(
						text,
						/baz\s+-\s+false/,
						'unexpected description'
					);
					assert.match(
						text,
						/bar\s+-\s+{"abc":123}/,
						'unexpected description'
					);
				});
			}
		}
	};
});
