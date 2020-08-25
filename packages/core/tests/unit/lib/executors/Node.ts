import { BigIntStats, statSync } from 'fs';
import { CoverageMap } from 'istanbul-lib-coverage';
import { Instrumenter } from 'istanbul-lib-instrument';
import { MapStore } from 'istanbul-lib-source-maps';
import { join, resolve } from 'path';
import { SinonSpy, createSandbox } from 'sinon';
import { RawSourceMap } from 'source-map';
import { isCancel } from '@theintern/common';
import { Config } from 'src/lib/config';
import * as libNode from 'src/lib/node';
import _Node from 'src/lib/executors/Node';
import Suite from 'src/lib/Suite';
import Test from 'src/lib/Test';
import { mockImport } from '@theintern-dev/test-util';
import resolveEnvironments from 'src/lib/resolveEnvironments';
import SeleniumTunnel from '@theintern/digdug/dist/SeleniumTunnel';
import { BrowserName } from '@theintern/digdug/dist/types';

registerSuite('lib/executors/Node', function () {
  const sandbox = createSandbox();

  // A default config that will enable functional tests for an executor
  const functionalConfig = {
    environments: ['chrome'],
    tunnel: 'null'
  };

  // These are suites that can be loaded if present in the `suites` or
  // `functionalSuites` list
  let availableSuites: { [name: string]: Suite | (() => Suite) } = {};

  // Create a test executor
  function createExecutor(config?: Partial<Config>) {
    const executor = new Node(config);

    executor.registerLoader(() => modules => {
      for (const mod of modules) {
        if (availableSuites[mod]) {
          const suite = availableSuites[mod];
          executor.addSuite(parent => {
            parent.add(typeof suite === 'function' ? suite() : suite);
          });
        }
      }
      return Promise.resolve();
    });

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
      return Promise.resolve();
    }

    setPageLoadTimeout() {
      return Promise.resolve();
    }
  }

  const mockSetPageLoadTimeout = sandbox.stub(
    MockCommand.prototype,
    'setPageLoadTimeout'
  );

  class MockCoverageMap {
    addFileCoverage: SinonSpy<[any]>;
    mockName = 'coverageMap';

    private _files: string[] = [];

    constructor() {
      coverageMaps.push(this);
      this.addFileCoverage = sandbox.spy(
        ({ filename }: { filename: string }) => {
          this._files.push(filename);
        }
      );
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
      this.start = sandbox.spy(this.start);
      this.stop = sandbox.spy(this.stop);
    }
    start() {
      return Promise.resolve();
    }
    stop() {
      return Promise.resolve();
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
    capabilities: Record<string, any>;

    constructor() {
      this.capabilities = {
        'is-test': true
      };
      sessions.push(this);
    }
  }

  const mockTunnelExtraCapabilities = { someFeature: 23 };

  class MockTunnel {
    extraCapabilities = mockTunnelExtraCapabilities;

    constructor(options: { [key: string]: any } = {}) {
      Object.keys(options).forEach(option => {
        (<any>this)[option] = options[option];
      });
      tunnels.push(this);
      this.start = sandbox.spy(this.start);
      this.stop = sandbox.spy(this.stop);
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
    log: sandbox.spy((..._args: any[]) => {}),
    warn: sandbox.spy((..._args: any[]) => {}),
    error: sandbox.spy((..._args: any[]) => {})
  };

  const mockChai = {
    assert: ('assert' as never) as Chai.Assert,
    should: sandbox.spy(() => ('should' as never) as Chai.Should)
  };

  const mockFs = {
    existsSync(path: any) {
      return Boolean(fsData[path]);
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

  const mockGlobal = {
    __coverage__: {},
    process: {
      cwd: () => '',
      env: {},
      exit: sandbox.spy((..._args: any[]) => {}),
      on: sandbox.spy((..._args: any[]) => {}),
      stdout: process.stdout
    }
  };

  class MockRemoteSuite {
    hasParent = true;
    tests = [];
    run() {
      return Promise.resolve();
    }
  }

  const mockTsNodeRegister = sandbox.spy();

  const mockResolveEnvironments = sandbox.spy(
    (...args: Parameters<typeof resolveEnvironments>) => {
      const envs = args[1];
      return envs as ReturnType<typeof resolveEnvironments>;
    }
  );

  const mockLibNode = {
    createConfigurator: libNode.createConfigurator,

    getDefaultBasePath: sandbox.spy(() => {
      return '/';
    }),

    getDefaultInternPath: sandbox.spy(() => {
      return '/intern';
    }),

    expandFiles(patterns?: string | string[]) {
      if (typeof patterns === 'string') {
        return [patterns];
      }
      return patterns || [];
    },

    readSourceMap() {
      return {} as RawSourceMap;
    },

    transpileSource: sandbox.spy(),

    isTypeScriptFile: sandbox.spy((file: string) => {
      return file.endsWith('.ts') || file.endsWith('tsx');
    }),

    ErrorFormatter: (MockErrorFormatter as unknown) as typeof libNode.ErrorFormatter
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

  return {
    async before() {
      ({ default: Node } = await mockImport(
        () => import('src/lib/executors/Node'),
        replace => {
          replace(() => import('src/lib/common/console')).with(mockConsole);
          replace(() => import('src/lib/common/console')).with(mockConsole);
          replace(() => import('chai')).with(mockChai);
          replace(() => import('@theintern/common'))
            .transparently()
            .with({ global: mockGlobal });
          replace(() => import('src/lib/node')).with(mockLibNode);
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
          replace(
            () => import('@theintern/digdug/dist/NullTunnel')
          ).withDefault(MockTunnel as any);
          replace(
            () => import('@theintern/digdug/dist/BrowserStackTunnel')
          ).withDefault(MockTunnel as any);
          replace(() => import('@theintern/digdug/dist/SeleniumTunnel')).with({
            default: (MockTunnel as unknown) as typeof SeleniumTunnel,
            getDriverNames(environments) {
              return environments.map(env => env.browserName as BrowserName);
            }
          });
          replace(
            () => import('@theintern/digdug/dist/TestingBotTunnel')
          ).withDefault(MockTunnel as any);
          replace(
            () => import('@theintern/digdug/dist/CrossBrowserTestingTunnel')
          ).withDefault(MockTunnel as any);
          replace(
            () => import('@theintern/digdug/dist/SauceLabsTunnel')
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
      availableSuites = {};
      sessions = [];
      fsData = {};
      executor = createExecutor();
      tsExtension = require.extensions['.ts'];
      delete require.extensions['.ts'];
    },

    afterEach() {
      require.extensions['.ts'] = tsExtension;
      sandbox.resetHistory();
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
            ],
            node: {
              tsconfig: false
            }
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
            const logger = sandbox.spy((..._args: any[]) => {});
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
            const logger = sandbox.spy((..._args: any[]) => {});
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
            const warningLogger = sandbox.spy((..._args: any[]) => {});
            executor.on('warning', warningLogger);
            const errorLogger = sandbox.spy((..._args: any[]) => {});
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
            const warningLogger = sandbox.spy((..._args: any[]) => {});
            executor.on('warning', warningLogger);
            const errorLogger = sandbox.spy((..._args: any[]) => {});
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
            const logger = sandbox.spy((..._args: any[]) => {});
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
            const warningLogger = sandbox.spy((..._args: any[]) => {});
            executor.on('warning', warningLogger);
            const errorLogger = sandbox.spy((..._args: any[]) => {});
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
            const warningLogger = sandbox.spy((..._args: any[]) => {});
            executor.on('warning', warningLogger);
            const errorLogger = sandbox.spy((..._args: any[]) => {});
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
              // The test module (ajv) needs to be accessible from the
              // executor's basePath
              executor.configure({ basePath: intern.config.basePath });

              const module = require.resolve('ajv');

              // Ensure the module isn't in the cache
              delete require.cache[module];

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
                assert.equal(
                  mockConsole.warn.callCount,
                  1,
                  'should have been a call to console.warn'
                );
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
              const expandFilesStub = sandbox.stub(mockLibNode, 'expandFiles');
              expandFilesStub.returns([
                resolve('bar/foo.js'),
                resolve('bar/baz.js')
              ]);
              executor.on(
                'beforeRun',
                dfd.callback(() => {
                  assert.isTrue(
                    executor.shouldInstrumentFile(resolve('bar/foo.js'))
                  );
                  assert.isFalse(
                    executor.shouldInstrumentFile(resolve('bar/blah.js'))
                  );
                  expandFilesStub.restore();
                })
              );
              executor.run();
            }
          }
        }
      },

      async '#resolveConfig'() {
        executor.configure({
          environments: 'chrome'
        });

        await executor.resolveConfig();

        // Verify that the tunnel's extra capabilities are mixed into the config
        assert.deepEqual(executor.config.capabilities, {
          buildId: undefined,
          name: 'intern',
          'idle-timeout': 60,
          ...mockTunnelExtraCapabilities
        });
      },

      '#run': {
        'with server'() {
          executor.configure({
            environments: 'chrome',
            tunnel: 'null',
            suites: 'foo.js',
            functionalSuites: 'bar.js',
            functionalTimeouts: { pageLoad: 10 }
          });

          return executor.run().then(() => {
            assert.lengthOf(
              leadfootServers,
              1,
              'expected a leadfoot server to be created'
            );
            assert.equal(
              mockSetPageLoadTimeout.callCount,
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

        async 'with BrowserStack server'() {
          executor.configure(<any>{
            environments: 'chrome',
            tunnel: 'browserstack',
            suites: 'foo2.js'
          });

          await executor.run();

          assert.deepEqual(
            executor.config.tunnelOptions.servers,
            [executor.config.serverUrl],
            'unexpected value for tunnelOptions.servers'
          );
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

        async 'full coverage'() {
          const fooFile = resolve('foo.js');
          const barFile = resolve('bar.js');
          fsData[fooFile] = 'foo';
          fsData[barFile] = 'bar';
          executor.configure({
            environments: 'chrome',
            tunnel: 'null',
            suites: 'foo.js',
            coverage: ['foo.js', 'bar.js']
          });

          await executor.run();

          const map = coverageMaps[0];
          assert.equal(
            map.addFileCoverage.callCount,
            2,
            'expected coverage to be added to both app files'
          );
          assert.deepEqual(map.addFileCoverage.args[0][0], {
            code: 'foo',
            filename: fooFile
          });
          assert.deepEqual(map.addFileCoverage.args[1][0], {
            code: 'bar',
            filename: barFile
          });
        },

        async cancel() {
          availableSuites['hang'] = new Suite({
            name: 'hang suite',
            executor,
            tests: [
              new Test({ name: 'hang test', test: () => new Promise(() => {}) })
            ]
          });

          executor.configure({
            ...functionalConfig,
            functionalSuites: ['hang']
          });

          const runPromise = executor.run();

          setTimeout(() => {
            executor.cancel();
          }, 1000);

          try {
            await runPromise;
            throw new Error('Run should not have passed');
          } catch (error) {
            assert.isTrue(
              isCancel(error),
              'expected test promise to be cancelled'
            );
          }
        },

        async 'failed suites'() {
          const failingSuite = new Suite({
            name: 'failing suite',
            executor,
            tests: [
              new Test({
                name: 'failing',
                test: () => Promise.reject('failed')
              })
            ]
          });
          availableSuites['failing'] = failingSuite;

          const runStub = sandbox.stub(failingSuite, 'run').callThrough();

          executor.configure({
            ...functionalConfig,
            functionalSuites: ['failing']
          });

          try {
            await executor.run();
          } catch (error) {
            // ignored
          }

          assert.strictEqual(runStub.callCount, 1);
        },

        async 'does not retry sessions without a successful session'() {
          const failingSuite = new Suite({
            name: 'failing suite',
            executor,
            tests: [
              new Test({
                name: 'failing',
                test: () => Promise.reject('failed')
              })
            ]
          });
          availableSuites['failingSuite'] = failingSuite;

          const runStub = sandbox.stub(failingSuite, 'run').callThrough();

          executor.configure({
            ...functionalConfig,
            functionalRetries: 10,
            functionalSuites: ['failingSuite']
          });

          try {
            await executor.run();
          } catch (error) {
            // ignored
          }

          assert.strictEqual(runStub.callCount, 1);
        },

        async retries() {
          let numFailedTests = 2;

          // Use factories for the mock suites since they'll need to be used
          // twice, once for each environment. Without using factory functions,
          // Suite will complain that each of them already has a parent the
          // second time they're used.

          const initiallyFailingSuite = () => {
            const suite = new Suite({
              name: 'initially failing suite',
              executor,
              tests: [
                new Test({ name: 'one', test: () => Promise.resolve() }),
                new Test({ name: 'two', test: () => Promise.resolve() })
              ]
            });

            sandbox.stub(suite, 'numFailedTests').get(() => numFailedTests);
            sandbox.stub(suite, 'run').callsFake(() => {
              numFailedTests--;
              return Promise.resolve();
            });

            return suite;
          };

          const passingSuite = () =>
            new Suite({
              name: 'passing suite',
              executor,
              tests: [new Test({ name: 'one', test: () => Promise.resolve() })]
            });

          availableSuites['initiallyFailing'] = initiallyFailingSuite;
          availableSuites['passing'] = passingSuite;

          executor.configure({
            ...functionalConfig,
            environments: ['chrome', 'firefox'],
            functionalRetries: 10,
            functionalSuites: ['initiallyFailing', 'passing']
          });

          await executor.run();
          assert.equal(
            numFailedTests,
            0,
            'exected failing run to have been called twice'
          );
        },

        proxies: {
          async tunnel() {
            executor.configure({
              ...functionalConfig,
              tunnel: 'browserstack',
              tunnelOptions: { proxy: 'foo' },
              suites: 'foo2.js'
            });

            await executor.run();

            assert.lengthOf(
              leadfootServers,
              1,
              'expected server to be started'
            );
            assert.equal(
              leadfootServers[0].args[1].proxy,
              'foo',
              'expected server to use tunnel proxy'
            );
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
          async 'no existing drivers'() {
            executor.configure(<any>{
              environments: ['chrome', 'firefox', 'ie'],
              tunnel: 'selenium',
              suites: 'foo2.js'
            });

            await executor.run();

            assert.sameDeepMembers(
              executor.config.tunnelOptions.drivers!,
              [
                { browserName: 'chrome' },
                { browserName: 'firefox' },
                { browserName: 'internet explorer' }
              ],
              'unexpected value for tunnelOptions.drivers'
            );
          },

          async 'existing drivers'() {
            executor.configure(<any>{
              environments: ['chrome', 'firefox', 'ie'],
              tunnel: 'selenium',
              tunnelOptions: {
                drivers: ['chrome', { name: 'ie' }]
              },
              suites: 'foo2.js'
            });

            await executor.run();

            assert.sameDeepMembers(
              executor.config.tunnelOptions.drivers!,
              [
                { browserName: 'chrome' },
                { browserName: 'firefox' },
                { browserName: 'internet explorer' }
              ],
              'unexpected value for tunnelOptions.drivers'
            );
          }
        },

        'tsconfig option': {
          'no tsConfig option specified': {
            async 'ts file in suites'() {
              const fooFile = resolve('foo.ts');
              const barFile = resolve('bar.ts');
              fsData[fooFile] = 'foo';
              fsData[barFile] = 'bar';
              executor.configure({
                environments: 'chrome',
                tunnel: 'null',
                suites: 'foo.ts',
                coverage: ['foo.ts', 'bar.d.ts']
              });

              await executor.run();

              assert.equal(
                mockLibNode.transpileSource.callCount,
                1,
                'expected 1 source file to be transpiled'
              );
              assert.deepEqual(
                mockLibNode.transpileSource.args[0],
                [fooFile, 'foo'],
                'expected given TS file to be transpiled'
              );
              assert.isTrue(
                mockTsNodeRegister.called,
                'expected ts-node/register to be called'
              );
              assert.deepEqual(
                mockTsNodeRegister.args[0],
                [],
                'expected ts-node/regsiter to be called without arguments'
              );
            },

            'ts file in plugins'() {
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
                assert.isTrue(mockLibNode.transpileSource.notCalled);
                assert.isTrue(mockTsNodeRegister.called);
                assert.deepEqual(mockTsNodeRegister.args[0], []);
              });
            },

            'ts file in functionalSuites'() {
              fsData['foo.js'] = 'foo';
              fsData['foo.ts'] = 'foo';

              (executor as any).loadScript = () => Promise.resolve();
              executor.configure(<any>{
                environments: 'chrome',
                tunnel: 'null',
                functionalSuites: 'foo.ts',
                coverage: ['foo.js']
              });

              return executor.run().then(() => {
                assert.isTrue(mockLibNode.transpileSource.notCalled);
                assert.isTrue(mockTsNodeRegister.called);
                assert.deepEqual(mockTsNodeRegister.args[0], []);
              });
            },

            async 'tsconfig exists'() {
              const basePath = resolve('/test');
              const expected = join(basePath, 'tsconfig.json');
              fsData['foo.js'] = 'foo';
              fsData['foo.ts'] = 'foo';
              fsData[expected] = JSON.stringify({});

              executor.loadScript = () => Promise.resolve();
              executor.configure({
                basePath,
                environments: 'chrome',
                tunnel: 'null',
                functionalSuites: 'foo.js',
                coverage: ['foo.js']
              });

              await executor.run();

              assert.isTrue(
                mockLibNode.transpileSource.notCalled,
                'expected transpileSource to not be called'
              );
              assert.isTrue(
                mockTsNodeRegister.called,
                'expected ts-node/register to be called'
              );
              assert.deepEqual(mockTsNodeRegister.args[0], [
                { project: expected }
              ]);
            },

            'no ts; then tsnode is not loaded'() {
              fsData['foo.js'] = 'foo';
              executor.configure(<any>{
                environments: 'chrome',
                tunnel: 'null',
                suites: 'foo.js',
                coverage: ['foo.js']
              });

              return executor.run().then(() => {
                assert.isTrue(mockLibNode.transpileSource.notCalled);
                assert.isTrue(mockTsNodeRegister.notCalled);
              });
            },

            async 'custom ts file'() {
              const fooFile = resolve('foo.ts');
              const barFile = resolve('bar.d.ts');
              fsData[fooFile] = 'foo';
              fsData[barFile] = 'bar';
              executor.configure({
                environments: 'chrome',
                tunnel: 'null',
                suites: 'foo.ts',
                node: {
                  tsconfig: './test/tsconfig.json'
                },
                coverage: ['foo.ts', 'bar.d.ts']
              });

              await executor.run();

              assert.equal(
                mockLibNode.transpileSource.callCount,
                1,
                'expected 1 file to be transpiled'
              );
              assert.deepEqual(mockLibNode.transpileSource.args[0], [
                fooFile,
                'foo'
              ]);
              assert.isTrue(
                mockTsNodeRegister.called,
                'expected ts-node/register to be called'
              );
              assert.deepEqual(
                mockTsNodeRegister.args[0][0],
                {
                  project: '/test/tsconfig.json'
                },
                'expected ts-node/register to be called with a confgi file'
              );
            }
          },

          async 'should not double register ts-node'() {
            require.extensions['.ts'] = () => {};
            const fooFile = resolve('foo.ts');
            const barFile = resolve('bar.d.ts');
            fsData[fooFile] = 'foo';
            fsData[barFile] = 'bar';
            executor.configure({
              environments: 'chrome',
              tunnel: 'null',
              suites: 'foo.ts',
              node: {
                tsconfig: './test/tsconfig.json'
              },
              coverage: ['foo.ts', 'bar.d.ts']
            });

            await executor.run();

            assert.equal(
              mockLibNode.transpileSource.callCount,
              1,
              'expected 1 file to be transpiled'
            );
            assert.deepEqual(
              mockLibNode.transpileSource.args[0],
              [fooFile, 'foo'],
              'unexpected file was transpiled'
            );
            assert.isTrue(
              mockTsNodeRegister.notCalled,
              'ts-node/register should not have been called'
            );
          },

          'tsConfig option specified as false'() {
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

          'tsConfig option specified as "false"'() {
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
