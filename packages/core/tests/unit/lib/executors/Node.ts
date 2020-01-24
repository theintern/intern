import { mockImport } from 'tests/support/mockUtil';
import { spy, SinonSpy, stub } from 'sinon';
import { Task, isPromiseLike, deepMixin } from '@theintern/common';
import { RawSourceMap } from 'source-map';
import { BigIntStats, PathLike, statSync } from 'fs';
import { sep } from 'path';
import { CoverageMap } from 'istanbul-lib-coverage';
import { Instrumenter } from 'istanbul-lib-instrument';
import { MapStore } from 'istanbul-lib-source-maps';

import { Config } from 'src/lib/common/config';
import _Node from 'src/lib/executors/Node';
import Suite from 'src/lib/Suite';

import { testProperty } from '../../../support/unit/executor';

registerSuite('lib/executors/Node', function () {
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
    addFileCoverage: SinonSpy<[any]>;
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
    log: spy((..._args: any[]) => {}),
    warn: spy((..._args: any[]) => {}),
    error: spy((..._args: any[]) => {})
  };

  const mockChai = {
    assert: ('assert' as never) as Chai.Assert,
    should: spy(() => ('should' as never) as Chai.Should)
  };

  const mockFs = {
    existsSync(_path: PathLike) {
      return true;
    },

    readFileSync(path: any) {
      if (fsData[path]) {
        return fsData[path] as any;
      }
      const error: NodeJS.ErrnoException = new Error('no such file');
      error.code = 'ENOENT';

      throw error;
    },

    statSync: ((() => {
      return {} as BigIntStats;
    }) as unknown) as typeof statSync
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
    join(...parts: string[]) {
      return parts.join('/');
    },
    sep: '/' as typeof sep
  };

  const mockGlobal = {
    __coverage__: {},
    process: {
      cwd: () => '',
      env: {},
      exit: spy((..._args: any[]) => {}),
      on: spy((..._args: any[]) => {}),
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

  const mockTsNodeRegister = spy();

  const mockResolveEnvironments = stub().returns(['foo env']);

  const mockNodeUtil = {
    expandFiles(patterns?: string | string[]) {
      if (typeof patterns === 'string') {
        return [patterns];
      }
      return patterns || [];
    },
    normalizePath(path: string) {
      return path;
    },
    readSourceMap() {
      return {} as RawSourceMap;
    },
    transpileSource: spy()
  };

  let executor: _Node;
  let reporters: MockReporter[];
  let tunnels: MockTunnel[];
  let servers: MockServer[];
  let leadfootServers: MockLeadfootServer[];
  let sessions: MockSession[];
  let coverageMaps: MockCoverageMap[];
  let Node: typeof _Node;
  let fsData: { [name: string]: string };
  let tsExtension: any;

  function setFunctionalSuites(
    loader: (options: { name: string; parent: Suite }) => void,
    functionalSuites: string[] = ['one.js']
  ) {
    executor.configure(<any>{
      name: 'foo executor',
      environments: ['chrome'],
      tunnel: 'null',
      functionalSuites
    });

    executor.registerLoader((_options: any) => (modules: string[]) => {
      modules.forEach(name => {
        if (functionalSuites.indexOf(name) >= 0) {
          executor.addSuite((parent: Suite) => {
            loader({ name, parent });
          });
        }
      });
      return Promise.resolve();
    });
  }

  return {
    async before() {
      ({ default: Node } = await mockImport(
        () => import('src/lib/executors/Node'),
        replace => {
          replace(() => import('src/lib/common/ErrorFormatter')).withDefault(
            MockErrorFormatter as any
          );
          replace(() => import('src/lib/common/console')).with(mockConsole);
          replace(() => import('chai')).with(mockChai);
          replace(() => import('@theintern/common')).with({
            global: mockGlobal,
            isPromiseLike,
            Task,
            deepMixin
          });
          replace(() => import('src/lib/node/util')).with(mockNodeUtil);
          replace(() => import('path')).with(mockPath);
          replace(() => import('fs')).with(mockFs);
          replace(() => import('src/lib/reporters/Pretty')).withDefault(
            MockReporter as any
          );
          replace(() => import('src/lib/reporters/Runner')).withDefault(
            MockReporter as any
          );
          replace(() => import('src/lib/reporters/Simple')).withDefault(
            MockReporter as any
          );
          replace(() => import('src/lib/reporters/JsonCoverage')).withDefault(
            MockReporter as any
          );
          replace(() => import('src/lib/reporters/HtmlCoverage')).withDefault(
            MockReporter as any
          );
          replace(() => import('src/lib/reporters/Lcov')).withDefault(
            MockReporter as any
          );
          replace(() => import('src/lib/reporters/Benchmark')).withDefault(
            MockReporter as any
          );
          replace(() => import('istanbul-lib-coverage')).with({
            classes: {
              FileCoverage: {
                prototype: {
                  merge() {}
                }
              } as any
            },
            createCoverageMap() {
              return (new MockCoverageMap() as unknown) as CoverageMap;
            }
          });
          replace(() => import('istanbul-lib-hook')).with({
            hookRunInThisContext() {
              return {};
            },
            hookRequire() {
              return () => ({});
            },
            unhookRunInThisContext() {
              return {};
            }
          });

          replace(() => import('istanbul-lib-instrument')).with({
            readInitialCoverage(code: string) {
              return {
                coverageData: `covered: ${code}`,
                path: '',
                hash: '',
                gcv: null
              };
            },
            createInstrumenter() {
              return (new MockInstrumenter() as unknown) as Instrumenter;
            }
          });

          replace(() => import('istanbul-lib-source-maps')).with({
            createSourceMapStore() {
              return (new MockMapStore() as unknown) as MapStore;
            }
          });
          replace(() => import('ts-node')).with({
            register: mockTsNodeRegister
          });
          replace(() => import('src/lib/Server')).withDefault(
            MockServer as any
          );
          replace(() => import('src/lib/resolveEnvironments')).withDefault(
            mockResolveEnvironments
          );
          replace(() => import('@theintern/leadfoot/dist/Command')).withDefault(
            MockCommand as any
          );
          replace(() => import('@theintern/leadfoot/dist/Server')).withDefault(
            MockLeadfootServer as any
          );
          replace(() =>
            import('@theintern/digdug/dist/NullTunnel')
          ).withDefault(MockTunnel as any);
          replace(() =>
            import('@theintern/digdug/dist/BrowserStackTunnel')
          ).withDefault(MockTunnel as any);
          replace(() =>
            import('@theintern/digdug/dist/SeleniumTunnel')
          ).withDefault(MockTunnel as any);
          replace(() =>
            import('@theintern/digdug/dist/TestingBotTunnel')
          ).withDefault(MockTunnel as any);
          replace(() =>
            import('@theintern/digdug/dist/CrossBrowserTestingTunnel')
          ).withDefault(MockTunnel as any);
          replace(() =>
            import('@theintern/digdug/dist/SauceLabsTunnel')
          ).withDefault(MockTunnel as any);
          replace(() => import('src/lib/ProxiedSession')).withDefault(
            MockSession as any
          );
          replace(() => import('src/lib/RemoteSuite')).withDefault(
            MockRemoteSuite as any
          );
        }
      ));
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
      tsExtension = require.extensions['.ts'];
      delete require.extensions['.ts'];
    },

    afterEach() {
      require.extensions['.ts'] = tsExtension;
      mockTsNodeRegister.resetHistory();
      mockConsole.log.resetHistory();
      mockConsole.warn.resetHistory();
      mockConsole.error.resetHistory();
      mockGlobal.process.on.resetHistory();
      mockNodeUtil.transpileSource.resetHistory();
      mockResolveEnvironments.resetHistory();
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
            const logger = spy((..._args: any[]) => {});
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
            const logger = spy((..._args: any[]) => {});
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
            const warningLogger = spy((..._args: any[]) => {});
            executor.on('warning', warningLogger);
            const errorLogger = spy((..._args: any[]) => {});
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
            const warningLogger = spy((..._args: any[]) => {});
            executor.on('warning', warningLogger);
            const errorLogger = spy((..._args: any[]) => {});
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
            const logger = spy((..._args: any[]) => {});
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
            const warningLogger = spy((..._args: any[]) => {});
            executor.on('warning', warningLogger);
            const errorLogger = spy((..._args: any[]) => {});
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
            const warningLogger = spy((..._args: any[]) => {});
            executor.on('warning', warningLogger);
            const errorLogger = spy((..._args: any[]) => {});
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
              // will be run from project/_tests
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
              const module = require.resolve('ajv');
              assert.isUndefined(
                require.cache[module],
                'expected test module not to be loaded already'
              );
              executor.loadScript('ajv');
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
                for (const call of mockConsole.warn.getCalls()) {
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
              executor.config.tunnelOptions.servers,
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
              assert.lengthOf(tunnels, 1, 'server should have been created');
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

          let settled = false;
          setFunctionalSuites(({ parent }) => {
            parent.add({
              name: 'hang suite',
              tests: [],
              parent,
              hasParent: true,
              run() {
                suiteTask = new Task<void>(
                  () => {},
                  () => {}
                );
                return suiteTask;
              }
            } as any);
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

        async 'failed suites'() {
          const runStub = stub().returns(Promise.resolve());
          setFunctionalSuites(({ parent }) => {
            parent.add({
              name: 'failing suite',
              tests: [],
              parent,
              hasParent: true,
              numFailedTests: 1,
              run: runStub
            } as any);
          });

          await executor.run();
          assert.strictEqual(runStub.callCount, 1);
        },

        async 'does not retry sessions without a successful session'() {
          const runStub = stub().returns(Promise.resolve());
          setFunctionalSuites(({ parent }) => {
            parent.add({
              name: 'failing suite',
              tests: [],
              parent,
              hasParent: true,
              numFailedTests: 1,
              run: runStub
            } as any);
          });
          executor.configure({
            functionalRetries: 10
          });

          await executor.run();
          assert.strictEqual(runStub.callCount, 1);
        },

        async retries() {
          mockResolveEnvironments.returns(['env1', 'env2']);
          executor.configure({
            environments: ['chrome', 'firefox']
          });
          let numFailedTests = 2;
          const runStub = stub().callsFake(() => {
            numFailedTests--;
            return Promise.resolve();
          });

          setFunctionalSuites(({ parent }) => {
            const mockSuites: { [key: string]: Partial<Suite> } = {
              env1: {
                name: 'initially failing suite',
                parent,
                hasParent: true,
                tests: [],
                numTests: 2,
                numSkippedTests: 0,
                get numFailedTests() {
                  return numFailedTests;
                },
                run: runStub
              },
              env2: {
                name: 'passing suite',
                parent,
                hasParent: true,
                tests: [],
                numFailedTests: 0,
                run: stub().returns(Promise.resolve())
              }
            };
            parent.add(mockSuites[parent.name!] as any);
          });
          executor.configure({
            functionalRetries: 10
          });

          await executor.run();

          assert.strictEqual(runStub.callCount, 2);
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
        },

        'selenium tunnelOptions': {
          'no existing drivers'() {
            executor.configure(<any>{
              environments: ['chrome', 'firefox', 'ie'],
              tunnel: 'selenium',
              suites: 'foo2.js'
            });
            return executor.run().then(() => {
              assert.sameDeepMembers(
                executor.config.tunnelOptions.drivers!,
                [
                  { name: 'chrome' },
                  { name: 'firefox' },
                  { name: 'internet explorer' }
                ],
                'unexpected value for tunnelOptions.drivers'
              );
            });
          },

          'existing drivers'() {
            executor.configure(<any>{
              environments: ['chrome', 'firefox', 'ie'],
              tunnel: 'selenium',
              tunnelOptions: {
                drivers: ['chrome', { name: 'ie', options: {} }]
              },
              suites: 'foo2.js'
            });
            return executor.run().then(() => {
              assert.sameDeepMembers(
                executor.config.tunnelOptions.drivers!,
                [
                  'chrome',
                  { name: 'firefox' },
                  { name: 'internet explorer', options: {} } as any
                ],
                'unexpected value for tunnelOptions.drivers'
              );
            });
          }
        },

        'tsconfig option': {
          'none specified and ts in suites'() {
            fsData['foo.ts'] = 'foo';
            fsData['bar.d.ts'] = 'bar';
            executor.configure(<any>{
              environments: 'chrome',
              tunnel: 'null',
              suites: 'foo.ts',
              coverage: ['foo.ts', 'bar.d.ts']
            });

            return executor.run().then(() => {
              assert.isTrue(mockNodeUtil.transpileSource.calledOnce);
              assert.deepEqual(mockNodeUtil.transpileSource.args[0], [
                'foo.ts',
                'foo'
              ]);
              assert.isTrue(mockTsNodeRegister.called);
              assert.deepEqual(mockTsNodeRegister.args[0], []);
            });
          },

          'none specified and ts in plugins'() {
            fsData['foo.js'] = 'foo';
            fsData['foo.ts'] = 'foo';

            (executor as any).loadScript = () => Promise.resolve();
            executor.configure(<any>{
              environments: 'chrome',
              tunnel: 'null',
              suites: 'foo.js',
              plugins: 'foo.ts',
              coverage: ['foo.js']
            });

            return executor.run().then(() => {
              assert.isTrue(mockNodeUtil.transpileSource.notCalled);
              assert.isTrue(mockTsNodeRegister.called);
              assert.deepEqual(mockTsNodeRegister.args[0], []);
            });
          },

          'none specified and no ts'() {
            fsData['foo.js'] = 'foo';
            executor.configure(<any>{
              environments: 'chrome',
              tunnel: 'null',
              suites: 'foo.js',
              coverage: ['foo.js']
            });

            return executor.run().then(() => {
              assert.isTrue(mockNodeUtil.transpileSource.notCalled);
              assert.isTrue(mockTsNodeRegister.notCalled);
            });
          },

          'custom specified'() {
            fsData['foo.ts'] = 'foo';
            fsData['bar.d.ts'] = 'bar';
            executor.configure(<any>{
              environments: 'chrome',
              tunnel: 'null',
              suites: 'foo.ts',
              node: {
                tsconfig: './test/tsconfig.json'
              },
              coverage: ['foo.ts', 'bar.d.ts']
            });

            return executor.run().then(() => {
              assert.isTrue(mockNodeUtil.transpileSource.calledOnce);
              assert.deepEqual(mockNodeUtil.transpileSource.args[0], [
                'foo.ts',
                'foo'
              ]);
              assert.isTrue(mockTsNodeRegister.calledOnce);
              assert.deepEqual(mockTsNodeRegister.args[0][0], {
                project: './test/tsconfig.json'
              });
            });
          },

          'should not double register ts-node'() {
            require.extensions['.ts'] = () => {};
            fsData['foo.ts'] = 'foo';
            fsData['bar.d.ts'] = 'bar';
            executor.configure(<any>{
              environments: 'chrome',
              tunnel: 'null',
              suites: 'foo.ts',
              node: {
                tsconfig: './test/tsconfig.json'
              },
              coverage: ['foo.ts', 'bar.d.ts']
            });

            return executor.run().then(() => {
              assert.isTrue(mockNodeUtil.transpileSource.calledOnce);
              assert.deepEqual(mockNodeUtil.transpileSource.args[0], [
                'foo.ts',
                'foo'
              ]);
              assert.isTrue(mockTsNodeRegister.notCalled);
            });
          },

          'specified as false'() {
            fsData['foo.ts'] = 'foo';
            executor.configure(<any>{
              environments: 'chrome',
              tunnel: 'null',
              suites: 'foo.ts',
              node: {
                tsconfig: false
              },
              coverage: ['foo.ts']
            });

            return executor.run().then(() => {
              assert.isTrue(mockTsNodeRegister.notCalled);
            });
          },

          'specified as "false"'() {
            fsData['foo.ts'] = 'foo';
            executor.configure(<any>{
              environments: 'chrome',
              tunnel: 'null',
              suites: 'foo.ts',
              node: {
                tsconfig: 'false'
              },
              coverage: ['foo.ts']
            });

            return executor.run().then(() => {
              assert.isTrue(mockTsNodeRegister.notCalled);
            });
          }
        }
      }
    }
  };
});
