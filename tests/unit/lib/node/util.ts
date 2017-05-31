import * as _util from 'src/lib/node/util';

const { registerSuite } = intern.getInterface('object');
const assert = intern.getAssertions('assert');
const { removeMocks, requireWithMocks } = <any>intern.getPlugin('mocking');

let util: typeof _util;

registerSuite('lib/node/util', function () {
	const mockFs = {
		readFile(filename: string, _encoding: any, callback: (error: Error | undefined, data?: string) => {}) {
			if (fsData[filename]) {
				callback(undefined, fsData[filename]);
			}
			const error = new Error('Not found');
			(<any>error).code = 'ENOENT';
			callback(error);
		},

		readFileSync(filename: string) {
			if (fsData[filename]) {
				return fsData[filename];
			}
			const error = new Error('Not found');
			(<any>error).code = 'ENOENT';
			throw error;
		}
	};

	const mockUtil = {
		loadConfig(filename: string, loadText: (filename: string) => Promise<string>, args?: string[], childConfig?: string) {
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

	const mockGlob = {
		sync(pattern: string) {
			logCall('sync', [pattern]);
			if (glob) {
				return glob(pattern);
			}
			return ['globby'];
		},

		hasMagic(pattern: string) {
			logCall('hasMagic', [pattern]);
			return hasMagic || false;
		}
	};

	const logCall = (name: string, args: any[]) => {
		if (!calls[name]) {
			calls[name] = [];
		}
		calls[name].push(args);
	};

	let hasMagic: boolean;
	let glob: ((pattern: string) => string[]) | undefined;
	let calls: { [name: string]: any[] };
	let parsedArgs: { [key: string]: any };
	let fsData: { [name: string]: string };
	let config: { [key: string]: any } | undefined;

	return {
		before() {
			return requireWithMocks(require, 'src/lib/node/util', {
				'fs': mockFs,
				'glob': mockGlob,
				'src/lib/common/util': mockUtil
			}).then((_util: any) => {
				util = _util;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			hasMagic = false;
			glob = undefined;
			config = undefined;
			calls = {};
			parsedArgs = {};
			fsData = {};
		},

		tests: {
			expandFiles: {
				none() {
					const files = util.expandFiles();
					assert.notProperty(calls, 'sync');
					assert.notProperty(calls, 'hasMagic');
					assert.lengthOf(files, 0);
				},

				single() {
					hasMagic = true;
					const magic = util.expandFiles('foo');
					assert.lengthOf(calls.sync, 1);
					assert.deepEqual(calls.sync[0], ['foo']);
					assert.lengthOf(calls.hasMagic, 1);
					assert.deepEqual(calls.hasMagic[0], ['foo']);
					assert.deepEqual(magic, ['globby'], 'expected value of glob call to be returned');

					hasMagic = false;
					const noMagic = util.expandFiles(['bar']);
					assert.lengthOf(calls.sync, 1, 'sync should not have been called');
					assert.lengthOf(calls.hasMagic, 2, 'hasMagic should have been called again');
					assert.deepEqual(calls.hasMagic[1], ['bar']);
					assert.deepEqual(noMagic, ['bar'], 'expected value of pattern to be returned');
				},

				multiple() {
					hasMagic = true;
					const files = util.expandFiles(['foo', 'bar']);
					assert.deepEqual(calls.sync, [['foo'], ['bar']]);
					assert.deepEqual(calls.hasMagic, [['foo'], ['bar']]);
					assert.deepEqual(files, ['globby', 'globby']);
				}
			},

			getConfig: {
				'default config': {
					exists() {
						parsedArgs.here = 1;
						parsedArgs.there = 'bar';
						fsData['intern.json'] = JSON.stringify({
							suites: ['bar.js']
						});

						return util.getConfig().then(config => {
							assert.notProperty(calls, 'splitConfigPath', 'splitConfigPath should not have been called');
							assert.property(calls, 'loadConfig', 'loadConfig should have been called');
							assert.equal(calls.loadConfig[0][0], 'intern.json');
							assert.deepEqual(config, { suites: ['bar.js'], here: 1, there: 'bar' });
						});
					},

					'does not exist'() {
						parsedArgs.here = 1;
						parsedArgs.there = 'bar';

						return util.getConfig().then(config => {
							assert.notProperty(calls, 'splitConfigPath', 'splitConfigPath should not have been called');
							assert.property(calls, 'loadConfig', 'loadConfig should have been called');
							assert.equal(calls.loadConfig[0][0], 'intern.json');
							assert.deepEqual(config, { here: 1, there: 'bar' });
						});
					},

					invalid() {
						fsData['intern.json'] = 'foo';

						return util.getConfig().then(
							_config => { throw new Error('getConfig should not have passed'); },
							error => { assert.match(error.message, /Unexpected token/); }
						);
					}
				},

				'custom config'() {
					parsedArgs.config = 'foo.json';
					fsData['foo.json'] = JSON.stringify({ stuff: 'happened' });

					return util.getConfig().then(config => {
						assert.property(calls, 'splitConfigPath', 'splitConfigPath should have been called');
						assert.deepEqual(calls.splitConfigPath, [['foo.json']]);
						assert.property(calls, 'loadConfig', 'loadConfig should have been called');
						assert.equal(calls.loadConfig[0][0], 'foo.json');
						assert.deepEqual(config, { stuff: 'happened' });
					});
				}
			},

			normalizePath() {
				assert.equal(util.normalizePath('/foo/bar'), '/foo/bar');
				assert.equal(util.normalizePath('C:\\foo\\bar'), 'C:/foo/bar');
			},

			readSourceMap: {
				'with code'() {
					fsData['foo.js.map'] = '{}';
					util.readSourceMap('foo.js', 'function () { console.log("hi"); }\n//# sourceMappingURL=foo.js.map');
				},

				'without code'() {
					fsData['foo.js'] = 'function () { console.log("hi"); }\n//# sourceMappingURL=foo.js.map';
					fsData['foo.js.map'] = '{}';
					util.readSourceMap('foo.js');
				},

				'embedded map'() {
					const map = Buffer.from('{}').toString('base64');
					const mapUrl = `data:application/json;charset=utf-8;base64,${map}`;
					util.readSourceMap('foo.js', `function () { console.log("hi"); }\n//# sourceMappingURL=${mapUrl}`);
				}
			}
		}
	};
});
