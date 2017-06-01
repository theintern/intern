import * as _util from 'src/lib/browser/util';
import Task from '@dojo/core/async/Task';
import { spy, SinonSpy } from 'sinon';

const { registerSuite } = intern.getInterface('object');
const assert = intern.getAssertions('assert');
const { removeMocks, requireWithMocks } = intern.getPlugin('mocking');

registerSuite('lib/browser/util', function () {
	class MockResponse {
		data: string | undefined;
		ok: boolean;
		status: number;

		constructor(data?: string) {
			this.data = data;
			this.ok = data != null;
			this.status = this.ok ? 200 : 404;
		}

		text() {
			return Task.resolve(this.data);
		}
	}

	const request = spy((path: string) => {
		const data = requestData && requestData[path];
		return Task.resolve(new MockResponse(data));
	});

	let util: typeof _util;
	let parsedArgs: { [key: string]: string | string[] };
	let requestData: { [name: string]: string };

	const mockUtil: { [name: string]: SinonSpy } = {
		loadConfig: spy((filename: string, loadText: (filename: string) => Promise<string>, _args?: string[], _childConfig?: string) => {
			return loadText(filename).then(text => {
				return JSON.parse(text);
			});
		}),

		parseArgs: spy(() => {
			return parsedArgs;
		}),

		splitConfigPath: spy((path: string) => {
			const parts = path.split('@');
			return { configFile: parts[0], childConfig: parts[1] };
		})
	};

	return {
		before() {
			return requireWithMocks(require, 'src/lib/browser/util', {
				'@dojo/core/request/providers/xhr': { default: request },
				'src/lib/common/util': mockUtil
			}).then((_util: any) => {
				util = _util;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			parsedArgs = {};
			requestData = {};
			request.reset();
			Object.keys(mockUtil).forEach(key => mockUtil[key].reset());
		},

		tests: {
			getConfig: {
				'default config': {
					exists() {
						parsedArgs.here = '1';
						parsedArgs.there = 'bar';
						const configData = { suites: ['bar.js'] };
						requestData['/intern.json'] = JSON.stringify(configData);

						return util.getConfig().then(config => {
							assert.equal(mockUtil.splitConfigPath.callCount, 0, 'splitConfigPath should not have been called');
							assert.equal(mockUtil.loadConfig.callCount, 1, 'loadConfig should have been called');
							assert.equal(mockUtil.parseArgs.callCount, 1, 'parseArgs should have been called');
							assert.equal(request.callCount, 1, 'request should have been called');
							assert.equal(mockUtil.loadConfig.getCall(0).args[0], '/intern.json');
							assert.deepEqual(mockUtil.loadConfig.getCall(0).args[2], { here: '1', there: 'bar' });
							// Since we've overridden loadConfig, args shouldn't actually be mixed in
							assert.deepEqual(config, configData);
						});
					},

					'does not exist'() {
						parsedArgs.here = '1';
						parsedArgs.there = 'bar';

						return util.getConfig().then(config => {
							assert.equal(mockUtil.splitConfigPath.callCount, 0, 'splitConfigPath should not have been called');
							assert.equal(mockUtil.loadConfig.callCount, 1, 'loadConfig should have been called');
							assert.equal(mockUtil.loadConfig.getCall(0).args[0], '/intern.json');
							assert.deepEqual(config, { here: '1', there: 'bar' });
						});
					},

					invalid() {
						requestData['/intern.json'] = 'foo';

						return util.getConfig().then(
							_config => { throw new Error('getConfig should not have passed'); },
							error => {
								if (
									(/JSON[. ]parse/i).test(error.message) ||
									(/Invalid character/i).test(error.message) ||
									(/Unexpected token/i).test(error.message)
								) {
									return;
								}
								throw error;
							}
						);
					}
				},

				'custom config'() {
					parsedArgs.config = 'foo.json';
					requestData['/foo.json'] = JSON.stringify({ stuff: 'happened' });

					return util.getConfig().then(config => {
						assert.equal(mockUtil.splitConfigPath.callCount, 1, 'splitConfigPath should have been called');
						assert.deepEqual(mockUtil.splitConfigPath.getCall(0).args, ['foo.json']);
						assert.equal(mockUtil.loadConfig.callCount, 1, 'loadConfig should have been called');
						assert.equal(mockUtil.loadConfig.getCall(0).args[0], '/foo.json');
						assert.deepEqual(config, { stuff: 'happened' });
					});
				}
			},

			normalizePath() {
				assert.equal(util.normalizePath('/foo/bar'), '/foo/bar');
				assert.equal(util.normalizePath('/foo/.././bar'), '/bar');
				assert.equal(util.normalizePath('.././bar'), '../bar');
			},

			parseQuery() {
				const rawArgs = util.parseQuery('foo&bar=5&baz=6&baz=7&baz=8');
				const expected = ['foo', 'bar=5', 'baz=6', 'baz=7', 'baz=8'];
				assert.deepEqual(rawArgs, expected);
			}
		}
	};
});
