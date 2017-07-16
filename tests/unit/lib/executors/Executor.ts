import _Executor, { Config } from 'src/lib/executors/Executor';
import Task from '@dojo/core/async/Task';
import { spy } from 'sinon';

// Import isSuite from the testing source rather than the source being tested
import { isSuite } from '../../../../src/lib/Suite';
import { testProperty } from '../../../support/unit/executor';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

// Create an interface to de-abstract the abstract properties in Executor
interface FullExecutor extends _Executor {
	new (config?: Partial<Config>): _Executor;
	environment: 'browser' | 'node';
	loadScript(_script: string | string[]): Task<void>;
}

let Executor: FullExecutor;

let removeMocks: () => void;

function assertRunFails(executor: _Executor, errorMatcher: RegExp) {
	return executor.run().then(
		() => { throw new Error('run should have failed'); },
		error => { assert.match(error.message, errorMatcher); }
	);
}

registerSuite('lib/executors/Executor', function () {
	class MockErrorFormatter {
		format(error: Error) {
			return 'Foo: ' + error.message;
		}
	}

	function createExecutor(config?: Partial<Config>) {
		const executor = new Executor(config);
		const testLoader = spy((mods: string[]) => {
			mods.forEach(mod => {
				if (scripts[mod]) {
					scripts[mod]();
				}
			});
			return Promise.resolve();
		});
		executor.registerLoader((_config: Config) => Promise.resolve(testLoader));
		(<any>executor).testLoader = testLoader;
		return executor;
	}

	const mockConsole = {
		log: spy(() => { }),
		warn: spy(() => { }),
		error: spy(() => { })
	};

	const mockChai = {
		assert: 'assert',
		should: spy(() => 'should')
	};

	const loadScript = spy((script: string) => {
		if (scripts[script]) {
			return Task.resolve(scripts[script]());
		}
		return Task.resolve();
	});

	let scripts: { [name: string]: () => void };
	let executor: _Executor;

	return {
		before() {
			return mockRequire(require, 'src/lib/executors/Executor', {
				'src/lib/common/ErrorFormatter': { default: MockErrorFormatter },
				'chai': mockChai,
				'@dojo/shim/global': {
					default: {
						console: mockConsole,
						'__coverage__': {}
					}
				}
			}).then(handle => {
				removeMocks = handle.remove;
				Executor = handle.module.default;
				Executor.prototype.loadScript = loadScript;
				Executor.prototype.environment = 'node';
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			mockConsole.log.reset();
			mockConsole.warn.reset();
			mockConsole.error.reset();
			loadScript.reset();
			scripts = {};

			executor = createExecutor();
		},

		tests: {
			construct: {
				'resources registered'() {
					// Plugins aren't resolved until _loadPlugins runs
					return executor.run().then(() => {
						assert.isDefined(executor.getPlugin('interface.object'));
						assert.isDefined(executor.getPlugin('interface.tdd'));
						assert.isDefined(executor.getPlugin('interface.bdd'));
						assert.isDefined(executor.getPlugin('interface.benchmark'));
						assert.throws(() => {
							assert.isUndefined(executor.getPlugin('foo'));
						}, /has not been registered/);
					});
				},

				'suite end listener'() {
					let coverageEmitted = false;
					executor.on('coverage', () => {
						coverageEmitted = true;
					});
					executor.emit('suiteEnd', <any>{ hasParent: true });
					assert.isFalse(coverageEmitted, 'coverage should not have been emitted for child suite');

					executor.emit('suiteEnd', <any>{});
					assert.isTrue(coverageEmitted, 'coverage should have been emitted for root suite');
				}
			},

			'#config'() {
				const expected = {
					bail: false,
					baseline: false,
					benchmark: false,
					browser: {
						plugins: [],
						reporters: [],
						require: [],
						suites: []
					},
					coverageVariable: '__coverage__',
					debug: false,
					defaultTimeout: 30000,
					filterErrorStack: false,
					grep: new RegExp(''),
					loader: { script: 'default' },
					name: 'intern',
					node: {
						plugins: [],
						reporters: [],
						require: [],
						suites: []
					},
					plugins: [],
					reporters: [],
					require: [],
					sessionId: '',
					suites: <string[]>[]
				};
				assert.deepEqual<any>(executor.config, expected);
			},

			'#formatError'() {
				const error = executor.formatError(new Error('bar'));
				assert.equal(error, 'Foo: bar');
			},

			'#addSuite'() {
				let rootSuite: any;
				const factory = (suite: any) => {
					rootSuite = suite;
				};
				executor.addSuite(factory);
				assert.isTrue(isSuite(rootSuite), 'expected root suite to be a Suite');
			},

			'#configure': {
				'add to property'() {
					executor.configure(<any>{ reporters: 'foo' });
					assert.deepEqual(executor.config.reporters, [
						{ name: 'foo' }
					]);

					executor.configure(<any>{ 'reporters+': 'bar' });
					assert.deepEqual(executor.config.reporters, [
						{ name: 'foo' },
						{ name: 'bar' }
					]);

					executor.configure(<any>{ 'grep+': 'bar' });
					assert.equal(executor.config.grep.toString(), '/bar/');
				},

				'unknown property'() {
					executor.configure(<any>{ foo: 'bar' });
					assert.propertyVal(executor.config, 'foo', 'bar');
					assert.equal(mockConsole.warn.callCount, 1, 'a warning should have been emitted');
					assert.match(mockConsole.warn.getCall(0).args[0], /has unknown option "foo"/);
				},

				'environment config mixin'() {
					executor.configure(<any>{ node: { suites: ['foo'], plugins: ['bar'] } });
					assert.deepEqual<any>(executor.config.node, {
						suites: ['foo'],
						plugins: [{ script: 'bar' }],
						reporters: [],
						require: []
					}, 'values should have been set on node');
					executor.configure(<any>{ node: { 'suites+': ['bif'], plugins: ['buf'], reporters: ['bof'] } });
					assert.deepEqual<any>(executor.config.node, {
						suites: ['foo', 'bif'],
						plugins: [{ script: 'buf' }],
						reporters: [{ name: 'bof' }],
						require: []
					}, 'values should have been mixed into node');
				},

				'known properties': (() => {
					function test(name: keyof Config, badValue: any, goodValue: any, expectedValue: any, error: RegExp, message?: string) {
						testProperty<_Executor, Config>(executor, mockConsole, name, badValue, goodValue, expectedValue, error, message);
					}

					const booleanTest = (name: keyof Config) => () => { test(name, 5, 'true', true, /Non-boolean/); };
					const stringTest = (name: keyof Config) => () => { test(name, 5, 'foo', 'foo', /Non-string/); };
					const objectArrayTest = (name: keyof Config, requiredProperty: string) => () => {
						test(name, 5, 'foo', [{ [requiredProperty]: 'foo' }], /Non-object/);
					};

					return {
						loader() {
							test('loader', 5, { script: 'foo' }, { script: 'foo' }, /Non-object value/);
							test('loader', { loader: 'foo' }, { script: 'foo' }, { script: 'foo' }, /Invalid value/);
						},

						bail: booleanTest('bail'),
						baseline: booleanTest('baseline'),
						benchmark: booleanTest('benchmark'),
						debug: booleanTest('debug'),
						filterErrorStack: booleanTest('filterErrorStack'),
						showConfig: booleanTest('showConfig'),

						basePath: stringTest('basePath'),
						coverageVariable: stringTest('coverageVariable'),
						description: stringTest('description'),
						internPath: stringTest('internPath'),
						name: stringTest('name'),
						sessionId: stringTest('sessionId'),

						defaultTimeout() {
							test('defaultTimeout', 'foo', 5, 5, /Non-numeric value/);
							test('defaultTimeout', 'foo', '5', 5, /Non-numeric value/);
						},

						grep() {
							test('grep', 5, 'foo', /foo/, /Non-regexp/);
							test('grep', 5, /foo/, /foo/, /Non-regexp/);
						},

						reporters: objectArrayTest('reporters', 'name'),
						plugins: objectArrayTest('plugins', 'script'),

						suites() {
							test('suites', 5, 'foo', ['foo'], /Non-string\[\]/);
							test('suites', 5, ['bar'], ['bar'], /Non-string\[\]/);
							test(<any>'suites+', 5, ['baz'], ['bar', 'baz'], /Non-string\[\]/, 'suite should have been added');
						},

						'environment resources'() {
							test('node', 5, {}, { plugins: [], reporters: [], require: [], suites: [] }, /Non-object/);
							test('browser', 5, {}, { plugins: [], reporters: [], require: [], suites: [] }, /Non-object/);
							test('node', 5, { suites: 'foo' }, { plugins: [], reporters: [], require: [], suites: ['foo'] }, /Non-object/);
						}
					};
				})()
			},

			'#emit': {
				'listeners notified'() {
					let notified = false;
					executor.on('suiteEnd', () => {
						notified = true;
					});
					executor.emit('suiteEnd', <any>{});
					assert.isTrue(notified, 'listener should have been notified');
				},

				'fails if a listener fails'() {
					executor.on('suiteEnd', () => {
						return Promise.resolve();
					});
					executor.on('suiteEnd', () => {
						return Promise.reject<void>(new Error('foo'));
					});

					return executor.emit('suiteEnd', <any>{}).then(
						() => { throw new Error('emit should have rejected'); },
						error => { assert.match(error.message, /foo/); }
					);
				},

				'suite failure'() {
					executor.emit('suiteEnd', <any>{ error: new Error('foo') });
					return assertRunFails(executor, /One or more suite errors/);
				},

				'test failure'() {
					executor.emit('testEnd', <any>{ error: new Error('foo') });
					return assertRunFails(executor, /One or more tests failed/);
				},

				'star listener'() {
					const events: string[] = [];
					executor.on('*', (event: { name: string, data: any }) => {
						events.push(event.name);
					});
					return executor.emit('suiteStart', <any>{}).then(() => {
						assert.deepEqual(events, ['suiteStart']);
						return executor.emit('testStart', <any>{});
					}).then(() => {
						assert.deepEqual(events, ['suiteStart', 'testStart']);
					});
				},

				'no error listeners'() {
					executor.emit('error', new Error('foo'));
					assert.equal(mockConsole.error.callCount, 1, 'an error should have been logged to the console');

					executor.on('error', () => { });
					executor.emit('error', new Error('foo'));
					assert.equal(mockConsole.error.callCount, 1, 'an error should not have been logged');
				}
			},

			'#getPlugin': {
				'registered'() {
					return executor.run().then(() => {
						assert.propertyVal(executor.getPlugin<any>('chai'), 'assert', 'assert');
					});
				},

				'not registered'() {
					return executor.run().then(() => {
						assert.throws(() => {
							executor.getPlugin<any>('foo');
						}, /has not been registered/);
					});
				}
			},

			'#log'() {
				let logger = spy(() => { });
				executor.on('log', logger);
				executor.log('testing');
				assert.equal(logger.callCount, 0, 'log should not have been emitted');

				const debugExecutor = createExecutor({ debug: true });
				debugExecutor.on('log', logger);
				debugExecutor.log('testing', new Error('foo'), () => { }, /bar/, 5);
				assert.equal(logger.callCount, 1, 'log should have been emitted');
				assert.match(logger.getCall(0).args[0], /^testing .*Error.*foo.* function \(\) {[^]*} \/bar\/ 5$/,
					'expected all args to have been serialized in log message');
			},

			'#on': {
				'single event'() {
					const logger = spy(() => { });
					const handle = executor.on('testStart', logger);
					executor.emit('testStart', <any>{});
					assert.equal(logger.callCount, 1, 'listener should have been called');
					handle.destroy();
					executor.emit('testStart', <any>{});
					assert.equal(logger.callCount, 1, 'listener should not have been called');

					// Calling handle again should be fine
					assert.doesNotThrow(() => { handle.destroy(); });
				},

				'all events'() {
					const logger = spy(() => { });
					executor.on(logger);
					executor.emit('testStart', <any>{});
					assert.equal(logger.callCount, 1, 'listener should have been called');
					executor.emit('testEnd', <any>{});
					assert.equal(logger.callCount, 2, 'listener should have been called');
				}
			},

			'#registerPlugin': {
				config() {
					executor.configure({ plugins: <any>'foo.js' });
					const pluginInit = spy(() => 'bar');
					const pluginScript = spy(() => {
						executor.registerPlugin('foo', pluginInit);
					});
					scripts['foo.js'] = pluginScript;
					return executor.run().then(() => {
						// One load for the plugin, and one for the suites
						const loader = (<any>executor).testLoader;
						assert.equal(loader.callCount, 2);
						assert.equal(loader.getCall(0).args[0], 'foo.js');
						assert.equal(pluginScript.callCount, 1);
						assert.equal(pluginInit.callCount, 1);
						assert.equal(executor.getPlugin('foo'), 'bar',
							'expected plugin to have resolved value of init function');
					});
				},

				direct() {
					executor.configure({ plugins: <any>'foo.js' });
					const pluginInit = spy(() => 'bar');
					executor.registerPlugin('foo', pluginInit);
					return executor.run().then(() => {
						assert.equal(pluginInit.callCount, 1);
						assert.equal(executor.getPlugin('foo'), 'bar',
							'expected plugin to have resolved value of init function');
					});
				},

				'invalid reporter'() {
					const pluginInit = spy(() => 'bar');
					assert.throws(() => {
						executor.registerPlugin('reporter', 'foo', pluginInit);
					}, /must be a constructor/);
				}
			},

			'#run': {
				showConfig() {
					const expected = '{\n' +
						'    "bail": false,\n' +
						'    "baseline": false,\n' +
						'    "benchmark": false,\n' +
						'    "browser": {\n' +
						'        "plugins": [],\n' +
						'        "reporters": [],\n' +
						'        "require": [],\n' +
						'        "suites": []\n' +
						'    },\n' +
						'    "coverageVariable": "__coverage__",\n' +
						'    "debug": false,\n' +
						'    "defaultTimeout": 30000,\n' +
						'    "filterErrorStack": false,\n' +
						'    "grep": {},\n' +
						'    "internPath": "",\n' +
						'    "loader": {\n' +
						'        "script": "default"\n' +
						'    },\n' +
						'    "name": "intern",\n' +
						'    "node": {\n' +
						'        "plugins": [],\n' +
						'        "reporters": [],\n' +
						'        "require": [],\n' +
						'        "suites": []\n' +
						'    },\n' +
						'    "plugins": [],\n' +
						'    "reporters": [],\n' +
						'    "require": [],\n' +
						'    "sessionId": "",\n' +
						'    "showConfig": true,\n' +
						'    "suites": []\n' +
						'}';
					executor.configure({ showConfig: true });

					const logger = spy(() => { });
					executor.on('beforeRun', logger);
					return executor.run().then(() => {
						assert.equal(mockConsole.log.getCall(0).args[0], expected);
						assert.equal(logger.callCount, 0, 'beforeRun should not have been emitted');
					});
				},

				'run error'() {
					executor.addSuite(rootSuite => { rootSuite.run = () => Task.reject<void>(new Error('foo')); });
					return assertRunFails(executor, /foo/);
				},

				'afterRun error'() {
					executor.on('afterRun', () => Promise.reject<void>(new Error('foo')));
					return assertRunFails(executor, /foo/);
				},

				'run start error'() {
					executor['_resolveConfig'] = () => { throw new Error('foo'); };
					return assertRunFails(executor, /foo/);
				},

				'invalid reporter': {
					missing() {
						executor.configure({ reporters: <any>'foo' });
						return assertRunFails(executor, /has not been registered/);
					},

					invalid() {
						executor.registerPlugin('reporter.foo', () => Promise.resolve({}));
						executor.configure({ reporters: <any>'foo' });
						return assertRunFails(executor, /A reporter plugin/);
					}
				},

				'loader failure'() {
					executor.registerLoader(() => Promise.reject(new Error('foo')));
					return assertRunFails(executor, /foo/);
				},

				'normalize intern path'() {
					executor.configure({ internPath: 'foo' });
					return executor.run().then(() => {
						const path = executor.config.internPath;
						assert.equal(path[path.length - 1], '/');
					});
				},

				'benchmark config'() {
					executor.configure({ showConfig: true });
					const executor2 = createExecutor({ showConfig: true, benchmark: true });
					const executor3 = createExecutor({ showConfig: true, benchmark: true, baseline: true });

					return executor.run()
						.then(() => {
							const data = JSON.parse(mockConsole.log.getCall(0).args[0]);
							assert.notProperty(data, 'benchmarkConfig');
							mockConsole.log.reset();
						})
						.then(() => executor2.run())
						.then(() => {
							const data = JSON.parse(mockConsole.log.getCall(0).args[0]);
							assert.property(data, 'benchmarkConfig');
							assert.propertyVal(data.benchmarkConfig, 'id', 'Benchmark');
							assert.propertyVal(data.benchmarkConfig, 'mode', 'test');
							mockConsole.log.reset();
						})
						.then(() => executor3.run())
						.then(() => {
							const data = JSON.parse(mockConsole.log.getCall(0).args[0]);
							assert.propertyVal(data.benchmarkConfig, 'mode', 'baseline');
						});
				}
			}
		}
	};
});
