import { spy, SinonSpy, stub } from 'sinon';
import { Task, deepMixin, isPromiseLike } from '@theintern/common';

import { Config } from 'src/lib/common/config';
import _Node from 'src/lib/executors/Node';
import Suite from 'src/lib/Suite';

import { testProperty } from '../../../support/unit/executor';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/executors/Node', function() {
  function createExecutor(config?: Partial<Config>) {
    const executor = new Node(config);
    executor.registerLoader((_options: any) => (_modules: string[]) =>
      Promise.resolve()
    );
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
    setPageLoadTimeout: SinonSpy;

    constructor() {
      this.setPageLoadTimeout = spy();
    }

    quit() {
      return Task.resolve();
    }
  }

  class MockCoverageMap {
    addFileCoverage: SinonSpy;
    mockName = 'coverageMap';

    private _files: string[] = [];

    constructor() {
      coverageMaps.push(this);
      this.addFileCoverage = spy(({ filename }: { filename: string }) => {
        this._files.push(filename);
      });
    }
    merge() {}
    files() {
      return this._files;
    }
  }

  class MockInstrumenter {
    private fileCoverage:
      | {
          code: string;
          filename: string;
          // tslint:disable-next-line:indent
        }
      | undefined;

    instrumentSync(code: string, filename: string) {
      this.fileCoverage = { code, filename };
      return `instrumented: ${code}`;
    }

    lastSourceMap() {}

    lastFileCoverage() {
      return this.fileCoverage;
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
    args: any[];

    constructor(...args: any[]) {
      this.args = args;
      leadfootServers.push(this);
    }

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

    constructor(options: { [key: string]: any } = {}) {
      Object.keys(options).forEach(option => {
        (<any>this)[option] = options[option];
      });
      tunnels.push(this);
      this.start = spy(this.start);
      this.stop = spy(this.stop);
    }
    getEnvironments() {
      return Promise.resolve([{ browserName: 'chrome', version: 53 }]);
    }
    on() {}
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
    registerMap() {}
  }

  const mockConsole = {
    log: spy(() => {}),
    warn: spy(() => {}),
    error: spy(() => {})
  };

  const mockChai = {
    assert: 'assert',
    should: spy(() => 'should')
  };

  const mockFs = {
    existsSync(_path: string) {
      return true;
    },

    readFileSync(path: string) {
      if (fsData[path]) {
        return fsData[path];
      }
      const error: NodeJS.ErrnoException = new Error('no such file');
      error.code = 'ENOENT';

      throw error;
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
    __coverage__: {},
    process: {
      cwd: () => '',
      env: {},
      exit: spy(() => {}),
      on: spy(() => {}),
      stdout: process.stdout
    }
  };

  class MockRemoteSuite {
    hasParent = true;
    tests = [];
    run() {
      return Task.resolve();
    }
  }

  const mockNodeUtil = {
    expandFiles(files: string) {
      return files || [];
    },
    normalizePath(path: string) {
      return path;
    },
    readSourceMap() {
      return {};
    }
  };

  let executor: _Node;
  let reporters: MockReporter[];
  let tunnels: MockTunnel[];
  let servers: MockServer[];
  let leadfootServers: MockLeadfootServer[];
  let sessions: MockSession[];
  let coverageMaps: MockCoverageMap[];
  let Node: typeof _Node;
  let removeMocks: () => void;
  let fsData: { [name: string]: string };

  return {
    before() {
      return mockRequire(require, 'src/lib/executors/Node', {
        'src/lib/common/ErrorFormatter': { default: MockErrorFormatter },
        'src/lib/common/console': mockConsole,
        'src/lib/node/util': mockNodeUtil,
        chai: mockChai,
        path: mockPath,
        fs: mockFs,
        '@theintern/common': {
          global: mockGlobal,
          isPromiseLike,
          Task,
          deepMixin
        },
        'src/lib/reporters/Pretty': { default: MockReporter },
        'src/lib/reporters/Runner': { default: MockReporter },
        'src/lib/reporters/Simple': { default: MockReporter },
        'src/lib/reporters/JsonCoverage': { default: MockReporter },
        'src/lib/reporters/HtmlCoverage': { default: MockReporter },
        'src/lib/reporters/Lcov': { default: MockReporter },
        'src/lib/reporters/Benchmark': { default: MockReporter },
        'istanbul-lib-coverage': {
          classes: {
            FileCoverage: {
              prototype: {
                merge() {}
              }
            }
          },
          createCoverageMap() {
            return new MockCoverageMap();
          }
        },
        'istanbul-lib-hook': {
          hookRunInThisContext() {},
          hookRequire() {},
          unhookRunInThisContext() {}
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
        'src/lib/RemoteSuite': { default: MockRemoteSuite }
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
      leadfootServers = [];
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
            assert.lengthOf(
              reporters,
              7,
              'unexpected number of reporters instantiated'
            );
          });
        },

        configure() {
          const configured = createExecutor({ suites: ['foo.js'] });
          assert.deepEqual(configured.config.suites, ['foo.js']);
        },

        'unhandled rejection': {
          async 'with reason'() {
            const logger = spy(() => {});
            executor.on('error', logger);
            const handler = mockGlobal.process.on.getCall(0).args[1];
            const reason = new Error('foo');
            handler({ reason });

            let caughtError: Error | undefined;
            try {
              await executor.run();
            } catch (error) {
              caughtError = error;
            }

            assert.isDefined(caughtError, 'run should have failed');

            assert.equal(logger.callCount, 1);
            assert.propertyVal(
              logger.getCall(0).args[0],
              'reason',
              reason,
              'expected emitted error to be error passed to listener'
            );
            assert.equal(caughtError!.message, 'An error was emitted');
          },

          async 'no reason'() {
            const logger = spy(() => {});
            executor.on('error', logger);
            const handler = mockGlobal.process.on.getCall(0).args[1];
            handler();

            let caughtError: Error | undefined;
            try {
              await executor.run();
            } catch (error) {
              caughtError = error;
            }

            assert.isDefined(caughtError, 'run should have failed');

            assert.equal(logger.callCount, 1);
            assert.isUndefined(
              logger.getCall(0).args[0],
              'expected emitted error to be error passed to listener'
            );
            assert.equal(caughtError!.message, 'An error was emitted');
          },

          async warning() {
            const warningLogger = spy(() => {});
            executor.on('warning', warningLogger);
            const errorLogger = spy(() => {});
            executor.on('error', errorLogger);
            executor.configure({ warnOnUnhandledRejection: true });

            const handler = mockGlobal.process.on.getCall(0).args[1];
            const reason1 = new Error('foo');
            handler(reason1);
            const reason2 = new Error('bar');
            handler(reason2);

            await executor.run();

            assert.equal(warningLogger.callCount, 2);
            assert.strictEqual(
              warningLogger.getCall(0).args[0],
              `${reason1}`,
              'expected emitted error to be error passed to warning listener'
            );
            assert.strictEqual(
              warningLogger.getCall(1).args[0],
              `${reason2}`,
              'expected emitted error to be error passed to warning listener'
            );
          },

          async 'warning (filtered)'() {
            const warningLogger = spy(() => {});
            executor.on('warning', warningLogger);
            const errorLogger = spy(() => {});
            executor.on('error', errorLogger);
            executor.configure({ warnOnUnhandledRejection: 'foo' });

            const handler = mockGlobal.process.on.getCall(0).args[1];
            const reason1 = new Error('foo');
            handler(reason1);
            const reason2 = new Error('bar');
            handler(reason2);

            let succeeded = false;
            try {
              await executor.run();
              succeeded = true;
            } catch (error) {
              // do nothing
            }

            assert.isFalse(succeeded, 'Run should have errored');

            assert.equal(warningLogger.callCount, 1);
            assert.strictEqual(
              warningLogger.getCall(0).args[0],
              `${reason1}`,
              'expected emitted error to be error passed to warning listener'
            );

            assert.equal(errorLogger.callCount, 1);
            assert.strictEqual(
              errorLogger.getCall(0).args[0],
              reason2,
              'expected emitted error to be error passed to error listener'
            );
          }
        },

        'unhandled error': {
          async default() {
            const logger = spy(() => {});
            executor.on('error', logger);
            const handler = mockGlobal.process.on.getCall(1).args[1];
            handler({ message: 'foo' });

            let caughtError: Error | undefined;
            try {
              await executor.run();
            } catch (error) {
              caughtError = error;
            }

            assert.isDefined(caughtError, 'run should have failed');

            assert.equal(logger.callCount, 1);
            assert.propertyVal(
              logger.getCall(0).args[0],
              'message',
              'foo',
              'expected emitted error to be error passed to listener'
            );
            assert.equal(caughtError!.message, 'An error was emitted');
          },

          async warning() {
            const warningLogger = spy(() => {});
            executor.on('warning', warningLogger);
            const errorLogger = spy(() => {});
            executor.on('error', errorLogger);
            executor.configure({ warnOnUncaughtException: true });

            const handler = mockGlobal.process.on.getCall(1).args[1];
            const reason1 = new Error('foo');
            handler(reason1);
            const reason2 = new Error('bar');
            handler(reason2);

            await executor.run();

            assert.equal(warningLogger.callCount, 2);
            assert.strictEqual(
              warningLogger.getCall(0).args[0],
              `${reason1}`,
              'expected emitted error to be error passed to warning listener'
            );
            assert.strictEqual(
              warningLogger.getCall(1).args[0],
              `${reason2}`,
              'expected emitted error to be error passed to warning listener'
            );
          },

          async 'warning (filtered)'() {
            const warningLogger = spy(() => {});
            executor.on('warning', warningLogger);
            const errorLogger = spy(() => {});
            executor.on('error', errorLogger);
            executor.configure({ warnOnUncaughtException: 'foo' });

            const handler = mockGlobal.process.on.getCall(1).args[1];
            const reason1 = new Error('foo');
            handler(reason1);
            const reason2 = new Error('bar');
            handler(reason2);

            let succeeded = false;
            let caughtError: Error | undefined;
            try {
              await executor.run();
              succeeded = true;
            } catch (error) {
              caughtError = error;
            }

            assert.isFalse(succeeded, 'Run should have errored');

            assert.equal(warningLogger.callCount, 1, 'Expected 1 warning');
            assert.strictEqual(
              warningLogger.getCall(0).args[0],
              `${reason1}`,
              'expected emitted error to be reason passed to warning listener'
            );

            assert.equal(errorLogger.callCount, 1, 'Expected 1 error');
            assert.propertyVal(
              errorLogger.getCall(0).args[0],
              'message',
              'bar',
              'expected emitted error to be error passed to listener'
            );
            assert.equal(caughtError!.message, 'An error was emitted');
          }
        }
      },

      '#configure': (() => {
        function test(
          name: keyof Config,
          badValue: any,
          goodValue: any,
          expectedValue: any,
          error: RegExp,
          allowDeprecated?: boolean | string,
          message?: string
        ) {
          testProperty<Config>(
            executor,
            mockConsole,
            name,
            badValue,
            goodValue,
            expectedValue,
            error,
            allowDeprecated,
            message
          );
        }

        const booleanTest = (name: keyof Config) => () => {
          test(name, 5, 'true', true, /Non-boolean/);
        };
        const stringTest = (name: keyof Config) => () => {
          test(name, 5, 'foo', 'foo', /Non-string/);
        };
        const numberTest = (name: keyof Config) => () => {
          test(name, 'foo', '5', 5, /Non-numeric/);
          test(name, 'foo', 5, 5, /Non-numeric/);
        };
        const stringArrayTest = (name: keyof Config) => () => {
          test(name, 5, 'foo', ['foo'], /Non-string/);
        };

        return {
          'capabilities (additive)'() {
            executor.configure(<any>{
              capabilities: { foo: 'bar' }
            });
            executor.configure(<any>{
              'capabilities+': { bar: 3 }
            });
            assert.deepEqual(executor.config.capabilities, <any>{
              foo: 'bar',
              bar: 3
            });
          },

          environments() {
            test(
              'environments',
              5,
              'chrome',
              [{ browserName: 'chrome' }],
              /Non-object/
            );
            test(
              'environments',
              { name: 'chrome' },
              'chrome',
              [{ browserName: 'chrome' }],
              /Invalid value.*missing/
            );
            test('environments', 5, '', [], /Non-object/);
          },

          instrumenterOptions: {
            basic() {
              test(
                'instrumenterOptions',
                5,
                { foo: 'bar' },
                { foo: 'bar' },
                /Non-object/
              );
            },

            additive() {
              executor.configure(<any>{
                instrumenterOptions: { foo: 'bar' }
              });
              executor.configure(<any>{
                'instrumenterOptions+': { bar: 3 }
              });
              assert.deepEqual(executor.config.instrumenterOptions, {
                foo: 'bar',
                bar: 3
              });
            }
          },

          tunnel() {
            test('tunnel', 5, 'null', 'null', /Non-string/);
          },

          'tunnelOptions (additive)'() {
            executor.configure(<any>{
              tunnelOptions: { foo: 'bar' }
            });
            executor.configure(<any>{
              'tunnelOptions+': { bar: 3 }
            });
            assert.deepEqual(executor.config.tunnelOptions, <any>{
              foo: 'bar',
              bar: 3
            });
          },

          functionalTimeouts() {
            test('functionalTimeouts', 5, { foo: 5 }, { foo: 5 }, /Non-object/);
            test(
              'functionalTimeouts',
              { foo: 'bar' },
              { foo: 5 },
              { foo: 5 },
              /Non-numeric/
            );
          },

          functionalCoverage: booleanTest('functionalCoverage'),

          leaveRemoteOpen() {
            test('leaveRemoteOpen', 'foo', 'fail', 'fail', /Invalid value/);
            test('leaveRemoteOpen', 'foo', 'true', true, /Invalid value/);
          },

          serveOnly: booleanTest('serveOnly'),
          runInSync: booleanTest('runInSync'),

          coverage: stringArrayTest('coverage'),
          functionalSuites: stringArrayTest('functionalSuites'),

          connectTimeout: numberTest('connectTimeout'),
          heartbeatInterval: numberTest('heartbeatInterval'),
          maxConcurrency: numberTest('maxConcurrency'),
          serverPort: numberTest('serverPort'),
          socketPort: numberTest('socketPort'),

          functionalBaseUrl: stringTest('functionalBaseUrl'),
          proxy: stringTest('proxy'),
          serverUrl: stringTest('serverUrl')
        };
      })(),

      '#coverageMap'() {
        assert.propertyVal(executor.coverageMap, 'mockName', 'coverageMap');
      },

      '#environment'() {
        assert.propertyVal(executor, 'environment', 'node');
      },

      '#instrumentedMapStore'() {
        assert.propertyVal(
          executor.instrumentedMapStore,
          'mockName',
          'mapStore'
        );
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
        // Run instrumentCode in a 'beforeRun' callback because the
        // instrumenter is initialized in _beforeRun
        executor.on(
          'beforeRun',
          dfd.callback(() => {
            assert.equal(
              executor.instrumentCode('foo', 'bar.js'),
              'instrumented: foo',
              'expected code to be run through the instrumenter'
            );
          })
        );
        executor.run();
      },

      '#loadScript': (() => {
        let modules: string[];

        return {
          beforeEach() {
            modules = Object.keys(require.cache);
          },

          afterEach() {
            const newModules = Object.keys(require.cache);
            for (const mod of newModules) {
              if (modules.indexOf(mod) === -1) {
                delete require.cache[mod];
              }
            }
          },

          tests: {
            'good script'() {
              const module = require.resolve(
                '../../data/lib/executors/intern.js'
              );
              assert.isUndefined(
                require.cache[module],
                'expected test module not to be loaded already'
              );
              executor.loadScript(module);
              assert.isDefined(
                require.cache[module],
                'expected module to have been loaded'
              );
            },

            'good node_module'() {
              const module = require.resolve('commander');
              assert.isUndefined(
                require.cache[module],
                'expected test module not to be loaded already'
              );
              executor.loadScript('commander');
              assert.isDefined(
                require.cache[module],
                'expected module to have been loaded'
              );
            },

            bad() {
              return executor.loadScript('fake_file.js').then(
                () => {
                  throw new Error('load should have failed');
                },
                error => {
                  assert.match(error.message, /Cannot find module/);
                }
              );
            }
          }
        };
      })(),

      '#shouldInstrument': {
        beforeEach() {
          executor.configure({ basePath: 'bar' });
        },

        tests: {
          'outside base path'() {
            const dfd = this.async();
            executor.on(
              'beforeRun',
              dfd.callback(() => {
                assert.isFalse(executor.shouldInstrumentFile('baz/foo.js'));
              })
            );
            executor.run();
          },

          excludeInstrumentation() {
            const dfd = this.async();
            executor.configure({ excludeInstrumentation: true });
            executor.on(
              'beforeRun',
              dfd.callback(() => {
                for (let call of mockConsole.warn.getCalls()) {
                  assert.include(
                    call.args[0],
                    'deprecated',
                    'warning should have been emitted'
                  );
                }
                assert.isUndefined(executor.config.excludeInstrumentation);
              })
            );
            executor.run();
          },

          coverage: {
            'instrumentation disabled'() {
              const dfd = this.async();
              executor.configure({ coverage: [] });
              executor.on(
                'beforeRun',
                dfd.callback(() => {
                  assert.isFalse(executor.shouldInstrumentFile('bar/foo.js'));
                })
              );
              executor.run();
            },

            'default filter'() {
              const dfd = this.async();
              executor.on(
                'beforeRun',
                dfd.callback(() => {
                  assert.isFalse(executor.shouldInstrumentFile('bar/foo.js'));
                })
              );
              executor.run();
            },

            'configured filter'() {
              const dfd = this.async();
              executor.configure({ coverage: ['bar/**/*.js'] });
              const expandFilesStub = stub(mockNodeUtil, 'expandFiles');
              expandFilesStub.returns(['bar/foo.js', 'bar/baz.js']);
              executor.on(
                'beforeRun',
                dfd.callback(() => {
                  assert.isTrue(executor.shouldInstrumentFile('bar/foo.js'));
                  assert.isFalse(executor.shouldInstrumentFile('bar/blah.js'));
                  expandFilesStub.restore();
                })
              );
              executor.run();
            }
          }
        }
      },

      '#run': {
        'with server'() {
          executor.configure(<any>{
            environments: 'chrome',
            tunnel: 'null',
            suites: 'foo.js',
            functionalTimeouts: { pageLoad: 10 }
          });
          return executor.run().then(() => {
            const suite = executor['_sessionSuites']![0];
            assert.equal(
              (<any>suite.remote.setPageLoadTimeout).callCount,
              1,
              'expected page load timeout to have been set'
            );
            assert.lengthOf(tunnels, 1, 'tunnel should have been created');
            assert.lengthOf(servers, 1, 'server should have been created');

            const tunnel: any = tunnels[0];
            assert.equal(
              tunnel.start.callCount,
              1,
              'server should have been started once'
            );
            assert.equal(
              tunnel.stop.callCount,
              1,
              'server should have been stopped once'
            );

            const server: any = servers[0];
            assert.equal(
              server.start.callCount,
              1,
              'server should have been started once'
            );
            assert.equal(
              server.stop.callCount,
              1,
              'server should have been stopped once'
            );

            // Check that session is a ProxiedSession
            assert.lengthOf(sessions, 1, 'a session should have been created');
            assert.property(sessions[0], 'coverageVariable');
            assert.property(sessions[0], 'baseUrl');
          });
        },

        'with BrowserStack server'() {
          executor.configure(<any>{
            environments: 'chrome',
            tunnel: 'browserstack',
            suites: 'foo2.js'
          });
          return executor.run().then(() => {
            assert.deepEqual(
              (<any>executor.config.tunnelOptions!).servers,
              [executor.config.serverUrl],
              'unexpected value for tunnelOptions.servers'
            );
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
          executor.on(
            'beforeRun',
            dfd.rejectOnError(() => {
              throw new Error('beforeRun should not have been emitted');
            })
          );
          executor.run().then(
            dfd.callback(() => {
              assert.lengthOf(tunnels, 0, 'no tunnel should have been created');
              assert.lengthOf(servers, 1, 'server should have been created');

              const server: any = servers[0];
              assert.equal(
                server.start.callCount,
                1,
                'server should have been started'
              );
              assert.equal(
                server.stop.callCount,
                1,
                'server should have been stopped'
              );
            })
          );

          setTimeout(() => {
            assert.equal(
              mockGlobal.process.on.getCall(2).args[0],
              'SIGINT',
              'expected SIGINT handler to be installed'
            );
            // Call the SIGINT handler, which will allow the run
            // call to proceed
            mockGlobal.process.on.getCall(2).args[1]();
          });
        },

        'benchmark mode'() {
          executor.configure({ benchmark: true });
          return executor.run().then(() => {
            assert.propertyVal(
              executor.config.reporters[0],
              'name',
              'benchmark',
              'expected benchmark reporter to be selected'
            );
            assert.lengthOf(
              executor.config.reporters,
              1,
              'should only have been 1 reporter selected'
            );
          });
        },

        'full coverage'() {
          fsData['foo.js'] = 'foo';
          fsData['bar.js'] = 'bar';
          executor.configure(<any>{
            environments: 'chrome',
            tunnel: 'null',
            suites: 'foo.js',
            coverage: ['foo.js', 'bar.js']
          });

          return executor.run().then(() => {
            const map: MockCoverageMap = executor.coverageMap as any;
            assert.isTrue(map.addFileCoverage.calledTwice);
            assert.deepEqual(map.addFileCoverage.args[0][0], {
              code: 'foo',
              filename: 'foo.js'
            });
            assert.deepEqual(map.addFileCoverage.args[1][0], {
              code: 'bar',
              filename: 'bar.js'
            });
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

          let settled = false;

          executor.registerLoader((_options: any) => (modules: string[]) => {
            if (modules[0] === 'foo.js') {
              executor.addSuite((parent: Suite) => {
                parent.add(<any>{
                  name: 'hang suite',
                  hasParent: true,
                  tests: [],
                  parent,
                  run() {
                    suiteTask = new Task<void>(() => {}, () => {});
                    return suiteTask;
                  }
                });
              });
            }
            return Promise.resolve();
          });

          const runTask = executor.run();
          runTask.then(
            () => {
              settled = true;
            },
            () => {
              settled = true;
            }
          );

          setTimeout(() => {
            runTask.cancel();
          }, 1000);

          runTask.finally(
            dfd.callback(() => {
              assert.isFalse(settled, 'expected test task to not be settled');
            })
          );
        },

        proxies: {
          tunnel() {
            executor.configure(<any>{
              environments: 'chrome',
              tunnel: 'browserstack',
              tunnelOptions: { proxy: 'foo' },
              suites: 'foo2.js'
            });
            return executor.run().then(() => {
              assert.equal(
                leadfootServers[0].args[1].proxy,
                'foo',
                'expected server to use tunnel proxy'
              );
            });
          },

          config() {
            executor.configure(<any>{
              environments: 'chrome',
              proxy: 'bar',
              tunnel: 'browserstack',
              tunnelOptions: { proxy: 'foo' },
              suites: 'foo2.js'
            });
            return executor.run().then(() => {
              assert.equal(
                leadfootServers[0].args[1].proxy,
                'bar',
                'expected server to use configured proxy'
              );
            });
          },

          none() {
            executor.configure(<any>{
              environments: 'chrome',
              proxy: null,
              tunnel: 'browserstack',
              tunnelOptions: { proxy: 'foo' },
              suites: 'foo2.js'
            });
            return executor.run().then(() => {
              assert.isUndefined(
                leadfootServers[0].args[1].proxy,
                'expected server to use configured proxy'
              );
            });
          }
        }
      }
    }
  };
});
