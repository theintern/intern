import { sandbox as Sandbox, SinonStub, SinonSpy } from 'sinon';
import Task from '@dojo/core/async/Task';
import global from '@dojo/shim/global';

import {
	createMockConsole,
	createMockNodeExecutor,
	MockConsole,
	MockNode
} from '../../support/unit/mocks';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');
const originalIntern = global.intern;

registerSuite('bin/intern', function() {
	const sandbox = Sandbox.create();
	const mockNodeUtil: { [name: string]: SinonSpy } = {
		getConfig: sandbox.spy(() => {
			return Task.resolve({ config: configData, file: 'intern.json' });
		})
	};

	const originalExitCode = process.exitCode;

	let configData: any;
	let removeMocks: (() => void) | undefined;
	let mockNode: MockNode;
	let mockConsole: MockConsole;
	let mockCommonUtil: { [name: string]: SinonStub };

	return {
		beforeEach() {
			mockNode = createMockNodeExecutor();
			mockConsole = createMockConsole();
			mockCommonUtil = {
				getConfigDescription: sandbox.stub().returns('test config')
			};

			sandbox.resetHistory();
			configData = {};
		},

		afterEach() {
			if (removeMocks) {
				removeMocks();
				removeMocks = undefined;
			}

			process.exitCode = originalExitCode;
			global.intern = originalIntern;
		},

		tests: {
			'basic run'() {
				const mockExecutor = createMockNodeExecutor();
				return mockRequire(require, 'src/bin/intern', {
					'src/lib/node/util': mockNodeUtil,
					'src/lib/common/console': mockConsole,
					'src/lib/common/util': mockCommonUtil,
					'src/index': { default: mockExecutor },
					'@dojo/shim/global': { default: { process: {} } }
				}).then(handle => {
					removeMocks = handle.remove;
					assert.equal(mockNodeUtil.getConfig.callCount, 1);
					assert.equal(
						mockCommonUtil.getConfigDescription.callCount,
						0
					);
					assert.isTrue(
						mockExecutor._ran,
						'expected executor to have run'
					);
				});
			},

			'show configs'() {
				configData = { showConfigs: true };

				return mockRequire(require, 'src/bin/intern', {
					'src/lib/node/util': mockNodeUtil,
					'src/lib/common/console': mockConsole,
					'src/lib/common/util': mockCommonUtil,
					'src/index': { default: createMockNodeExecutor() },
					'@dojo/shim/global': {
						default: { process: {} }
					}
				}).then(handle => {
					removeMocks = handle.remove;
					assert.equal(mockNodeUtil.getConfig.callCount, 1);
					assert.equal(
						mockCommonUtil.getConfigDescription.callCount,
						1
					);
					assert.deepEqual(mockConsole.log.args, [['test config']]);
				});
			},

			'bad run': {
				'intern defined'() {
					return mockRequire(require, 'src/bin/intern', {
						'src/lib/node/util': mockNodeUtil,
						'src/lib/common/console': mockConsole,
						'src/lib/common/util': mockCommonUtil,
						'src/index': { default: createMockNodeExecutor() },
						'@dojo/shim/global': {
							default: { process: {} }
						}
					}).then(handle => {
						removeMocks = handle.remove;
						assert.equal(
							mockConsole.error.callCount,
							0,
							'expected error not to be called'
						);
					});
				},

				'intern not defined'() {
					configData = { showConfigs: true };
					mockCommonUtil.getConfigDescription.throws();

					return mockRequire(require, 'src/bin/intern', {
						'src/lib/node/util': mockNodeUtil,
						'src/lib/common/console': mockConsole,
						'src/lib/common/util': mockCommonUtil,
						'src/index': { default: createMockNodeExecutor() },
						'@dojo/shim/global': {
							default: {
								process: { stdout: process.stdout }
							}
						}
					})
						.then(handle => {
							removeMocks = handle.remove;
							return new Promise(resolve =>
								setTimeout(resolve, 10)
							);
						})
						.then(() => {
							assert.equal(
								mockConsole.error.callCount,
								1,
								'expected error to be called once'
							);
						});
				}
			},

			help() {
				const mockExecutor = createMockNodeExecutor(<any>{
					_config: {
						foo: 'one',
						bar: [2, 3],
						baz: { value: false }
					}
				});
				configData = { help: true };

				return mockRequire(require, 'src/bin/intern', {
					'src/lib/node/util': mockNodeUtil,
					'src/lib/common/console': mockConsole,
					'src/lib/common/util': mockCommonUtil,
					'src/index': { default: mockExecutor },
					'@dojo/shim/global': {
						default: { process: {} }
					}
				}).then(handle => {
					removeMocks = handle.remove;
					assert.match(
						mockConsole.log.args[0][0],
						/intern version \d/
					);
					assert.match(mockConsole.log.args[1][0], /npm version \d/);
					assert.match(
						mockConsole.log.args[2][0],
						/node version v\d/
					);
					assert.deepEqual(mockConsole.log.args.slice(4), [
						[
							'Usage: intern [config=<file>] [showConfig|showConfigs] [options]'
						],
						[],
						['  config      - path to a config file'],
						['  showConfig  - show the resolved config'],
						['  showConfigs - show information about configFile'],
						[],
						["Options (set with 'option=value' or 'option'):\n"],
						['  bar - [2,3]'],
						['  baz - {"value":false}'],
						['  foo - "one"'],
						[],
						["Using config file 'intern.json':\n"],
						['test config']
					]);
				});
			}
		}
	};
});
