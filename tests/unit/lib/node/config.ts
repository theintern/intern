import Task from '@dojo/core/async/Task';

import * as _config from 'src/lib/node/config';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/node/config', function() {
	let nodeConfig: typeof _config;

	const mockConfig = {
		getBasePath() {
			return '';
		},

		loadConfig(
			filename: string,
			loadText: (filename: string) => Promise<string>,
			args?: string[],
			childConfig?: string,
			_processOption?: () => boolean
		) {
			logCall('loadConfig', [filename, loadText, args, childConfig]);
			return loadText(filename).then(text => {
				return JSON.parse(text);
			});
		},

		parseArgs(...args: any[]) {
			logCall('parseArgs', args);
			return parsedArgs;
		},

		splitConfigPath(path: string) {
			logCall('splitConfigPath', [path]);
			const parts = path.split('@');
			return { configFile: parts[0], childConfig: parts[1] };
		}
	};

	const mockPath = {
		resolve(path: string) {
			return path;
		}
	};

	const logCall = (name: string, args: any[]) => {
		if (!calls[name]) {
			calls[name] = [];
		}
		calls[name].push(args);
	};

	const mockGlobal = {
		process: {
			argv: ['node', 'intern.js'],
			env: {}
		}
	};

	const mockUtil = {
		loadText(filename: string) {
			if (fsData[filename]) {
				return Task.resolve(fsData[filename]);
			}
			const error = new Error('Not found');
			(<any>error).code = 'ENOENT';
			return Task.reject(error);
		}
	};

	let calls: { [name: string]: any[] };
	let parsedArgs: { [key: string]: string | string[] };
	let fsData: { [name: string]: string };
	let removeMocks: () => void;

	return {
		before() {
			return mockRequire(require, 'src/lib/node/config', {
				path: mockPath,
				'src/lib/node/util': mockUtil,
				'src/lib/common/config': mockConfig,
				'@dojo/shim/global': { default: mockGlobal }
			}).then(handle => {
				removeMocks = handle.remove;
				nodeConfig = handle.module;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			calls = {};
			parsedArgs = {};
			fsData = {};
			mockGlobal.process.argv = ['node', 'intern.js'];
			mockGlobal.process.env = {};
		},

		tests: {
			getConfig: {
				'default config': {
					exists() {
						const configData = { suites: ['bar.js'] };
						fsData['intern.json'] = JSON.stringify(configData);

						return nodeConfig
							.getConfig()
							.then(({ config, file }) => {
								assert.strictEqual(
									file,
									'intern.json',
									'unexpected config file name'
								);
								assert.notProperty(
									calls,
									'splitConfigPath',
									'splitConfigPath should not have been called'
								);
								assert.property(
									calls,
									'loadConfig',
									'loadConfig should have been called'
								);
								assert.notProperty(
									calls,
									'parseArgs',
									'parseArgs should not have been called'
								);
								assert.equal(
									calls.loadConfig[0][0],
									'intern.json'
								);

								// Since we've overridden loadConfig, args shouldn't
								// actually be mixed in. The final data will have a
								// basePath of '', because the config file path
								// (used to derive the basePath) has no parent path.
								const data = { ...configData, basePath: '' };
								assert.deepEqual(config, data);
							});
					},

					'does not exist'() {
						// Push an argument so parseArgs will be called
						mockGlobal.process.argv.push('foo');

						return nodeConfig.getConfig().then(({ config }) => {
							assert.notProperty(
								calls,
								'splitConfigPath',
								'splitConfigPath should not have been called'
							);
							assert.property(
								calls,
								'loadConfig',
								'loadConfig should have been called'
							);
							assert.property(
								calls,
								'parseArgs',
								'parseArgs should have been called'
							);
							assert.equal(calls.loadConfig[0][0], 'intern.json');
							assert.deepEqual(config, {});
						});
					},

					invalid() {
						fsData['intern.json'] = 'foo';

						return nodeConfig.getConfig().then(
							_config => {
								throw new Error(
									'getConfig should not have passed'
								);
							},
							error => {
								assert.match(error.message, /Unexpected token/);
							}
						);
					},

					'custom args': {
						'invalid argv format'() {
							return nodeConfig
								.getConfig(['suites=foo.js'])
								.then(() => {
									assert.notProperty(
										calls,
										'parseArgs',
										'parseArgs should not have been called'
									);
								});
						},

						'valid argv'() {
							return nodeConfig
								.getConfig([
									'node',
									'intern.js',
									'suites=foo.js'
								])
								.then(() => {
									assert.property(
										calls,
										'parseArgs',
										'parseArgs should have been called'
									);
								});
						}
					}
				},

				'custom config'() {
					// Push a dummy arg to get Intern to call parseArgs
					mockGlobal.process.argv.push('foo');
					parsedArgs.config = 'foo.json';
					fsData['foo.json'] = JSON.stringify({ stuff: 'happened' });

					return nodeConfig.getConfig().then(({ config }) => {
						assert.property(
							calls,
							'splitConfigPath',
							'splitConfigPath should have been called'
						);
						assert.deepEqual(calls.splitConfigPath, [['foo.json']]);
						assert.property(
							calls,
							'loadConfig',
							'loadConfig should have been called'
						);
						assert.equal(calls.loadConfig[0][0], 'foo.json');

						// Since we've overridden loadConfig, args shouldn't
						// actually be mixed in. The final data will have a
						// basePath of '', because the config file path
						// (used to derive the basePath) has no parent path.
						const data = { stuff: 'happened', basePath: '' };
						assert.deepEqual(config, data);
					});
				}
			}
		}
	};
});
