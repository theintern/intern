import _Node, { Config } from 'src/lib/executors/Node';
import Suite from 'src/lib/Suite';
import Task, { State } from '@dojo/core/async/Task';
import { spy, SinonSpy } from 'sinon';

import { testProperty } from '../../../support/unit/executor';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/executors/Node', function () {
	function createExecutor(config?: Partial<Config>) {
		const executor = new Node(config);
		executor.registerLoader((_options: any) => (_modules: string[]) => Promise.resolve());
		return executor;
	}

	class MockErrorFormatter {
		format(error: Error) {
			return 'Foo: ' + error.message;
		}
	}

	class MockReporter {
		constructor() {
			reporters.push(this);
		}
	}

	class MockCommand {
		session = {};
		quit() {
			return Task.resolve();
		}
	}

	class MockCoverageMap {
		mockName = 'coverageMap';
		constructor() {
			coverageMaps.push(this);
			this.addFileCoverage = spy(this.addFileCoverage);
		}
		addFileCoverage() {
		}
		merge() {
		}
		files() {
			return [];
		}
	}

	class MockInstrumenter {
		instrumentSync(code: string) {
			return `instrumented: ${code}`;
		}

		lastSourceMap() {
		}
	}

	class MockServer {
		constructor() {
			servers.push(this);
			this.start = spy(this.start);
			this.stop = spy(this.stop);
		}
		start() {
			return Task.resolve();
		}
		stop() {
			return Task.resolve();
		}
		subscribe() {
			return { destroy() {} };
		}
	}

	class MockLeadfootServer {
		sessionConstructor: any;

		createSession() {
			return Promise.resolve(new this.sessionConstructor());
		}
	}

	class MockSession {
		constructor() {
			sessions.push(this);
		}
	}

	class MockTunnel {
		extraCapabilities = {};
		constructor() {
			tunnels.push(this);
			this.start = spy(this.start);
			this.stop = spy(this.stop);
		}
		getEnvironments() {
			return Promise.resolve([
				{ browserName: 'chrome', version: 53 }
			]);
		}
		on() { }
		sendJobState() {
			return Promise.resolve();
		}
		start() {
			return Promise.resolve();
		}
		stop() {
			return Promise.resolve();
		}
	}

	class MockMapStore {
		mockName = 'mapStore';
		registerMap() {
		}
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

	const mockFs = {
		readFileSync(path: string) {
			if (fsData[path]) {
				return fsData[path];
			}
			const error: NodeJS.ErrnoException = new Error('no such file');
			error.code = 'ENOENT';
			return error;
		}
	};

	const mockPath = {
		resolve(path: string) {
			return path;
		},
		dirname(path: string) {
			return path;
		},
		relative(path: string) {
			return path;
		},
		normalize(path: string) {
			return path;
		},
		sep: '/'
	};

	const mockGlobal = {
		console: mockConsole,
		'__coverage__': {},
		process: {
			cwd: () => '',
			env: {},
			exit: spy(() => { }),
			on: spy(() => { }),
			stdout: process.stdout
		}
	};

	class MockRemoteSuite {
		hasParent = true;
		tests = [];
		run() { return Task.resolve(); }
	}

	let executor: _Node;
	let reporters: MockReporter[];
	let tunnels: MockTunnel[];
	let servers: MockServer[];
	let sessions: MockSession[];
	let coverageMaps: MockCoverageMap[];
	let Node: typeof _Node;
	let removeMocks: () => void;
	let fsData: { [name: string]: string };

	return {
		before() {
			return mockRequire(require, 'src/lib/executors/Node', {
				'src/lib/common/ErrorFormatter': { default: MockErrorFormatter },
				'src/lib/node/util': {
					expandFiles(files: string[]) {
						return files || [];
					},
					normalizePath(path: string) {
						return path;
					},
					readSourceMap() {
						return {};
					}
				},
				'chai': mockChai,
				'path': mockPath,
				'fs': mockFs,
				'@dojo/shim/global': { default: mockGlobal },
				'src/lib/reporters/Pretty': { default: MockReporter },
				'src/lib/reporters/Runner': { default: MockReporter },
				'src/lib/reporters/Simple': { default: MockReporter },
				'src/lib/reporters/JsonCoverage': { default: MockReporter },
				'src/lib/reporters/HtmlCoverage': { default: MockReporter },
				'src/lib/reporters/Lcov': { default: MockReporter },
				'src/lib/reporters/Benchmark': { default: MockReporter },
				'istanbul-lib-coverage': {
					createCoverageMap() {
						return new MockCoverageMap();
					}
				},
				'istanbul-lib-hook': {
					hookRunInThisContext() { },
					hookRequire() { },
					unhookRunInThisContext() { }
				},
				'istanbul-lib-instrument': {
					createInstrumenter() {
						return new MockInstrumenter();
					},
					readInitialCoverage(code: string) {
						return { coverageData: `covered: ${code}` };
					}
				},
				'istanbul-lib-source-maps': {
					createSourceMapStore() {
						return new MockMapStore();
					}
				},
				'src/lib/Server': { default: MockServer },
				'src/lib/resolveEnvironments': {
					default: () => {
						return ['foo env'];
					}
				},
				'@theintern/leadfoot/Command': { default: MockCommand },
				'@theintern/leadfoot/Server': { default: MockLeadfootServer },
				'@theintern/digdug/NullTunnel': { default: MockTunnel },
				'@theintern/digdug/BrowserStackTunnel': { default: MockTunnel },
				'src/lib/ProxiedSession': { default: MockSession },
				'src/lib/RemoteSuite': { default: MockRemoteSuite },
				'src/lib/executors/Executor': null
			}).then(handle => {
				removeMocks = handle.remove;
				Node = handle.module.default;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			coverageMaps = [];
			reporters = [];
			tunnels = [];
			servers = [];
			sessions = [];
			fsData = {};
			executor = createExecutor();
		},

		afterEach() {
			mockConsole.log.reset();
			mockConsole.warn.reset();
			mockConsole.error.reset();
			mockGlobal.process.on.reset();
		},

		tests: {
			construct: {
				'default reporters'() {
					executor.configure(<any>{
						reporters: [
							'pretty',
							'simple',
							'runner',
							'benchmark',
							'jsoncoverage',
							'htmlcoverage',
							'lcov'
						]
					});
					return executor.run().then(() => {
						assert.lengthOf(reporters, 7, 'unexpected number of reporters instantiated');
					});
				},

				configure() {
					const configured = createExecutor({ suites: ['foo.js'] });
					assert.deepEqual(configured.config.suites, ['foo.js']);
				},

				'unhandled rejection'() {
					const logger = spy(() => { });
					const handler = mockGlobal.process.on.getCall(0).args[1];
					const reason = new Error('foo');
					handler(reason);
					assert.equal(logger.callCount, 0);
					assert.strictEqual(mockConsole.warn.callCount, 1, 'expected warning to have been logged');

					executor.on('error', logger);
					handler(reason);
					assert.equal(logger.callCount, 1);
					assert.strictEqual(logger.getCall(0).args[0], reason, 'expected emitted error to be error passed to listener');
				},

				'unhandled error'() {
					const logger = spy(() => { });
					const handler = mockGlobal.process.on.getCall(1).args[1];
					assert.strictEqual(mockConsole.warn.callCount, 0, 'no warning should have been logged yet');
					handler({ message: 'foo' });
					assert.equal(logger.callCount, 0);
					assert.strictEqual(mockConsole.warn.callCount, 1, 'expected warning to have been logged');

					executor.on('error', logger);
					handler({ message: 'foo' });
					assert.equal(logger.callCount, 1);
					assert.propertyVal(logger.getCall(0).args[0], 'message', 'Uncaught exception: foo',
						'expected emitted error to be error passed to listener');
				}
			},

			'#configure': (() => {
				function test(name: keyof Config, badValue: any, goodValue: any, expectedValue: any, error: RegExp, allowDeprecated?: boolean | string, message?: string) {
					testProperty<_Node, Config>(executor, mockConsole, name, badValue, goodValue, expectedValue, error, allowDeprecated, message);
				}

				const booleanTest = (name: keyof Config) => () => { test(name, 5, 'true', true, /Non-boolean/); };
				const numberTest = (name: keyof Config) => () => {
					test(name, 'foo', '5', 5, /Non-numeric/);
					test(name, 'foo', 5, 5, /Non-numeric/);
				};
				const stringArrayTest = (name: keyof Config) => () => {
					test(name, 5, 'foo', ['foo'], /Non-string/);
				};

				return {
					environments() {
						test('environments', 5, 'chrome', [{ browserName: 'chrome' }], /Non-object/);
						test('environments', { name: 'chrome' }, 'chrome', [{ browserName: 'chrome' }], /Invalid value.*missing/);
						test('environments', 5, '', [], /Non-object/);
					},

					instrumenterOptions() {
						test('instrumenterOptions', 5, { foo: 'bar' }, { foo: 'bar' }, /Non-object/);
					},

					tunnel() {
						test('tunnel', 5, 'null', 'null', /Non-string/);
					},

					excludeInstrumentation() {
						test('excludeInstrumentation', 5, true, true, /Invalid value/, true);
						test('excludeInstrumentation', 5, /foo/, /foo/, /Invalid value/, true);
						test('excludeInstrumentation', 5, 'foo', /foo/, /Invalid value/, true);
					},

					functionalCoverage: booleanTest('functionalCoverage'),
					leaveRemoteOpen: booleanTest('leaveRemoteOpen'),
					serveOnly: booleanTest('serveOnly'),
					runInSync: booleanTest('runInSync'),

					coverage: stringArrayTest('coverage'),
					functionalSuites: stringArrayTest('functionalSuites'),

					connectTimeout: numberTest('connectTimeout'),
					maxConcurrency: numberTest('maxConcurrency'),
					serverPort: numberTest('serverPort'),
					socketPort: numberTest('socketPort')
				};
			})(),

			'#coverageMap'() {
				assert.propertyVal(executor.coverageMap, 'mockName', 'coverageMap');
			},

			'#environment'() {
				assert.propertyVal(executor, 'environment', 'node');
			},

			'#instrumentedMapStore'() {
				assert.propertyVal(executor.instrumentedMapStore, 'mockName', 'mapStore');
			},

			'#sourceMapStore'() {
				assert.propertyVal(executor.sourceMapStore, 'mockName', 'mapStore');
			},

			'#addSuite'() {
				let rootSuite: any;
				const factory = (suite: any) => {
					rootSuite = suite;
				};
				executor.addSuite(factory);
				assert.isDefined(rootSuite, 'expected root suite to be defined');
			},

			'#instrumentCode'() {
				const dfd = this.async();
				// Run instrumentCode in a 'beforeRun' callback because the instrumenter is initialized in _beforeRun
				executor.on('beforeRun', dfd.callback(() => {
					assert.equal(executor.instrumentCode('foo', 'bar.js'), 'instrumented: foo',
						'expected code to be run through the instrumenter');
				}));
				executor.run();
			},

			'#loadScript': {
				good() {
					const module = require.resolve('../../data/lib/executors/intern.js');
					assert.isUndefined(require.cache[module], 'expected test module not to be loaded already');
					executor.loadScript(module);
					assert.isDefined(require.cache[module], 'expected module to have been loaded');
					delete require.cache[module];
				},

				bad() {
					return executor.loadScript('fake_file.js').then(
						() => { throw new Error('load should have failed'); },
						error => { assert.match(error.message, /Cannot find module/); }
					);
				}
			},

			'#shouldInstrument': {
				'instrumentation disabled'() {
					const dfd = this.async();
					executor.configure({ excludeInstrumentation: true, basePath: 'bar' });
					executor.on('beforeRun', dfd.callback(() => {
						assert.isFalse(executor.shouldInstrumentFile('bar/foo.js'));
					}));
					executor.run();
				},

				'default filter'() {
					const dfd = this.async();
					executor.configure({ basePath: 'bar' });
					executor.on('beforeRun', dfd.callback(() => {
						assert.isFalse(executor.shouldInstrumentFile('bar/foo.js'));
					}));
					executor.run();
				},

				'configured filter'() {
					const dfd = this.async();
					executor.configure({ basePath: 'bar', excludeInstrumentation: /foo/ });
					executor.on('beforeRun', dfd.callback(() => {
						assert.isFalse(executor.shouldInstrumentFile('bar/foo.js'));
					}));
					executor.run();
				}
			},

			'#run': {
				'with server'() {
					executor.configure(<any>{
						environments: 'chrome',
						tunnel: 'null',
						suites: 'foo.js'
					});
					return executor.run().then(() => {
						assert.lengthOf(tunnels, 1, 'tunnel should have been created');
						assert.lengthOf(servers, 1, 'server should have been created');

						const tunnel: any = tunnels[0];
						assert.equal(tunnel.start.callCount, 1, 'server should have been started once');
						assert.equal(tunnel.stop.callCount, 1, 'server should have been stopped once');

						const server: any = servers[0];
						assert.equal(server.start.callCount, 1, 'server should have been started once');
						assert.equal(server.stop.callCount, 1, 'server should have been stopped once');

						// Check that session is a ProxiedSession
						assert.lengthOf(sessions, 1, 'a session should have been created');
						assert.property(sessions[0], 'coverageEnabled');
						assert.property(sessions[0], 'coverageVariable');
						assert.property(sessions[0], 'serverUrl');
					});
				},

				'with BrowserStack server'() {
					executor.configure(<any>{
						environments: 'chrome',
						tunnel: 'browserstack',
						suites: 'foo2.js'
					});
					return executor.run().then(() => {
						assert.deepEqual((<any>executor.config.tunnelOptions!).servers, [executor.config.serverUrl],
							'unexpected value for tunnelOptions.servers');
					});
				},

				'serve only'() {
					const dfd = this.async();
					executor.configure(<any>{
						serveOnly: true,
						environments: 'chrome',
						tunnel: 'null',
						suites: 'foo.js'
					});
					executor.on('beforeRun', dfd.rejectOnError(() => {
						throw new Error('beforeRun should not have been emitted');
					}));
					executor.run().then(dfd.callback(() => {
						assert.lengthOf(tunnels, 0, 'no tunnel should have been created');
						assert.lengthOf(servers, 1, 'server should have been created');

						const server: any = servers[0];
						assert.equal(server.start.callCount, 1, 'server should have been started');
						assert.equal(server.stop.callCount, 1, 'server should have been stopped');
					}));

					setTimeout(() => {
						assert.equal(mockGlobal.process.on.getCall(2).args[0], 'SIGINT', 'expected SIGINT handler to be installed');
						// Call the SIGINT handler, which will allow the run call to proceed
						mockGlobal.process.on.getCall(2).args[1]();
					});
				},

				'benchmark mode'() {
					executor.configure({ benchmark: true });
					return executor.run().then(() => {
						assert.propertyVal(executor.config.reporters[0], 'name', 'benchmark',
							'expected benchmark reporter to be selected');
						assert.lengthOf(executor.config.reporters, 1, 'should only have been 1 reporter selected');
					});
				},

				'full coverage'() {
					fsData['foo.js'] = 'foo';
					executor.configure(<any>{
						environments: 'chrome',
						tunnel: 'null',
						suites: 'foo.js',
						coverage: ['foo.js']
					});
					return executor.run().then(() => {
						assert.lengthOf(coverageMaps, 1);

						const addFileCoverage = <SinonSpy>coverageMaps[0].addFileCoverage;
						assert.equal(addFileCoverage.callCount, 1);
						assert.equal(addFileCoverage.getCall(0).args[0], 'covered: instrumented: foo');
					});
				},

				cancel() {
					const dfd = this.async();
					let suiteTask: Task<void>;

					executor.configure(<any>{
						name: 'foo executor',
						environments: 'chrome',
						tunnel: 'null',
						functionalSuites: ['foo.js']
					});
					executor.registerLoader((_options: any) => (modules: string[]) => {
						if (modules[0] === 'foo.js') {
							executor.addSuite((parent: Suite) => {
								parent.add(<any>{
									name: 'hang suite',
									hasParent: true,
									tests: [],
									parent,
									run() {
										suiteTask = new Task<void>(() => { }, () => { });
										return suiteTask;
									}
								});
							});
						}
						return Promise.resolve();
					});

					const runTask = executor.run();

					setTimeout(() => {
						runTask.cancel();
					}, 1000);

					runTask.finally(dfd.callback(() => {
						assert.equal(suiteTask.state, State.Canceled, 'expected test task to be canceled');
					}));
				}
			}
		}
	};
});
