import { mockImport } from 'tests/support/mockUtil';
import { createSandbox, spy, SinonSpy } from 'sinon';
import { isCancel, isPromiseLike, deepMixin } from 'src/common';
import {
  Configurator,
  createConfig,
  createConfigurator
} from 'src/core/lib/config';

import Suite from 'src/core/lib/Suite';
import Test from 'src/core/lib/Test';
import _Executor, {
  Config,
  Events,
  Plugins
} from 'src/core/lib/executors/Executor';

// Import isSuite from the testing source rather than the source being tested
import { isSuite } from 'src/core/lib/Suite';
// import { testProperty } from 'tests/support/unit/executor';

type ExecutorType = _Executor<Events, Plugins>;

// Create an interface to de-abstract the abstract properties in Executor
class FullExecutor extends _Executor<Events, Plugins> {
  environment: 'browser' | 'node' = 'node';

  loadScript(_script: string | string[]): Promise<void> {
    return Promise.resolve();
  }
}

function assertRunFails(executor: ExecutorType, errorMatcher: RegExp) {
  return executor.run().then(
    () => {
      throw new Error('run should have failed');
    },
    error => {
      assert.match(error.message, errorMatcher);
    }
  );
}

registerSuite('core/lib/executors/Executor', function() {
  let Executor: typeof FullExecutor;

  class MockErrorFormatter {
    format(error: Error) {
      return 'Foo: ' + error.message;
    }
  }

  const sandbox = createSandbox();
  const testLoader = sandbox.spy((mods: string[]) => {
    mods.forEach(mod => {
      if (scripts[mod]) {
        scripts[mod]();
      }
    });
    return Promise.resolve();
  });

  function createExecutor(config?: Partial<Config>) {
    const executor = new Executor(mockCreateConfigurator, config);
    executor.registerLoader((_config: { [key: string]: any }) =>
      Promise.resolve(testLoader)
    );
    (<any>executor).testLoader = testLoader;
    return executor;
  }

  const configurator = createConfigurator({
    loadText: () => Promise.resolve(''),
    resolvePath: (path: string) => path,
    dirname: (path: string) => path,
    isAbsolute: () => false,
    defaultBasePath: '/',
    sep: '/'
  });

  const mockConfigurator = {
    addToConfig: sandbox.spy(
      (...args: Parameters<Configurator['addToConfig']>) =>
        configurator.addToConfig(...args)
    ),
    describeConfig: sandbox.spy(
      (...args: Parameters<Configurator['describeConfig']>) =>
        configurator.describeConfig(...args)
    ),
    loadConfig: sandbox.spy((...args: Parameters<Configurator['loadConfig']>) =>
      configurator.loadConfig(...args)
    )
  };

  function mockCreateConfigurator(): Configurator {
    return mockConfigurator;
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

  const loadScript = sandbox.spy((script: string) => {
    if (scripts[script]) {
      return Promise.resolve(scripts[script]());
    }
    return Promise.resolve();
  });

  let scripts: { [name: string]: () => void };
  let executor: ExecutorType;

  return {
    async before() {
      const { default: BaseExecutor } = await mockImport(
        () => import('src/core/lib/executors/Executor'),
        replace => {
          replace(() =>
            import('src/core/lib/common/ErrorFormatter')
          ).withDefault(MockErrorFormatter as any);
          replace(() => import('src/core/lib/common/console')).with(
            mockConsole
          );
          replace(() => import('chai')).with(mockChai);
          replace(() => import('src/common'))
            .transparently()
            .with({
              global: { __coverage__: {} },
              deepMixin,
              isPromiseLike
            });
        }
      );

      Executor = BaseExecutor as typeof FullExecutor;
      Executor.prototype.loadScript = loadScript;
      Executor.prototype.environment = 'node';
    },

    beforeEach() {
      sandbox.reset();
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
          assert.isFalse(
            coverageEmitted,
            'coverage should not have been emitted for child suite'
          );

          executor.emit('suiteEnd', <any>{});

          return executor.run().then(() => {
            assert.isTrue(
              coverageEmitted,
              'coverage should have been emitted for root suite'
            );
          });
        }
      },

      '#config'() {
        const expected = createConfig();
        const actual = executor.config;

        assert.match(expected.tunnelOptions.tunnelId!, /\d+/);
        assert.match(actual.tunnelOptions.tunnelId!, /\d+/);

        assert.deepEqualExcluding(executor.config, expected, 'tunnelOptions');
        assert.deepEqualExcluding(
          executor.config.tunnelOptions,
          expected.tunnelOptions,
          'tunnelId'
        );
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

      '#configure'() {
        executor.configure({ internPath: 'foo' });
        assert.equal(
          mockConfigurator.addToConfig.callCount,
          1,
          'Executor should have added new data to config'
        );
      },

      '#emit': {
        'listeners notified'() {
          let notified = false;
          executor.on('suiteEnd', () => {
            notified = true;
          });
          executor.emit('suiteEnd', <any>{});
          return executor.run().then(() => {
            assert.isTrue(notified, 'listener should have been notified');
          });
        },

        'fails if a listener fails'() {
          executor.on('suiteEnd', () => {
            return Promise.resolve();
          });
          executor.on('suiteEnd', () => {
            return Promise.reject<void>(new Error('foo'));
          });

          return executor.run().then(
            () => {
              throw new Error('emit should have rejected');
            },
            error => {
              assert.equal(error.message, 'An error was emitted');
            }
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
          const expected = [
            'beforeRun',
            'runStart',
            'suiteStart',
            'coverage',
            'suiteEnd',
            'runEnd',
            'afterRun'
          ];
          executor.on('*', (event: { name: string; data: any }) => {
            events.push(event.name);
          });
          return executor
            .run()
            .then(() => {
              assert.deepEqual(events, expected);
              return executor.emit('testStart', <any>{});
            })
            .then(() => {
              assert.deepEqual(events, [...expected, 'testStart']);
            });
        },

        'no error listeners'() {
          return executor.run().then(() => {
            executor.emit('error', new Error('foo'));
            assert.equal(
              mockConsole.error.callCount,
              1,
              'an error should have been logged to the console'
            );

            executor.on('error', () => {});
            executor.emit('error', new Error('foo'));
            assert.equal(
              mockConsole.error.callCount,
              1,
              'an error should not have been logged'
            );
          });
        }
      },

      '#getPlugin': {
        registered() {
          return executor.run().then(() => {
            assert.propertyVal(
              executor.getPlugin<any>('chai'),
              'assert',
              'assert'
            );
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

      async '#log'() {
        const logger = spy((..._args: any[]) => {});
        executor.on('log', logger);
        executor.log('testing');
        assert.equal(logger.callCount, 0, 'log should not have been emitted');

        const debugExecutor = createExecutor({ debug: true });
        debugExecutor.on('log', logger);
        await debugExecutor.log(
          'testing',
          new Error('foo'),
          () => {},
          /bar/,
          5
        );
        assert.equal(logger.callCount, 1, 'log should have been emitted');
        assert.match(logger.getCall(0).args[0], /Error.*foo/);
      },

      '#on': {
        'single event'() {
          const logger = spy(() => {});
          const handle = executor.on('testStart', logger);
          return executor.run().then(() => {
            return executor
              .emit('testStart', <any>{})
              .then(() => {
                assert.equal(
                  logger.callCount,
                  1,
                  'listener should have been called'
                );
                handle.destroy();
                return executor.emit('testStart', <any>{});
              })
              .then(() => {
                assert.equal(
                  logger.callCount,
                  1,
                  'listener should not have been called'
                );

                // Calling handle again should be fine
                assert.doesNotThrow(() => {
                  handle.destroy();
                });
              });
          });
        },

        'all events'() {
          const logger = spy(() => {});
          return executor.run().then(() => {
            executor.on(logger);
            return executor
              .emit('testStart', <any>{})
              .then(() => {
                assert.equal(
                  logger.callCount,
                  1,
                  'listener should have been called'
                );
                return executor.emit('testEnd', <any>{});
              })
              .then(() => {
                assert.equal(
                  logger.callCount,
                  2,
                  'listener should have been called'
                );
              });
          });
        }
      },

      '#registerPlugin': {
        config() {
          executor.configure({
            plugins: { script: 'foo.js', useLoader: true }
          });
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
            assert.equal(
              executor.getPlugin('foo'),
              'bar',
              'expected plugin to have resolved value of init function'
            );
          });
        },

        direct() {
          executor.configure({ plugins: 'foo.js' });
          const pluginInit = spy(() => 'bar');
          executor.registerPlugin('foo', pluginInit);
          return executor.run().then(() => {
            assert.equal(pluginInit.callCount, 1);
            assert.equal(
              executor.getPlugin('foo'),
              'bar',
              'expected plugin to have resolved value of init function'
            );
          });
        },

        'invalid reporter'() {
          const pluginInit = spy(() => 'bar');
          assert.throws(() => {
            executor.registerPlugin('reporter', 'foo', pluginInit as any);
          }, /must be a constructor/);
        }
      },

      '#run': {
        'run error'() {
          executor.addSuite(rootSuite => {
            rootSuite.run = () => Promise.reject<void>(new Error('foo'));
          });
          return assertRunFails(executor, /foo/);
        },

        'afterRun error'() {
          executor.on('afterRun', () => Promise.reject<void>(new Error('foo')));
          return assertRunFails(executor, /An error was emitted/);
        },

        'run start error'() {
          executor.resolveConfig = () => {
            throw new Error('foo');
          };
          return assertRunFails(executor, /foo/);
        },

        'custom reporter'() {
          executor.registerPlugin('reporter.foo', () => {
            const CustomReporter = function() {};
            return Promise.resolve(CustomReporter);
          });
          executor.configure({ reporters: <any>'foo' });
          // Executor should run successfully
          return executor.run();
        },

        'invalid reporter': {
          missing() {
            executor.configure({ reporters: <any>'foo' });
            return assertRunFails(executor, /has not been registered/);
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

        async 'benchmark config'() {
          // executor.configure({ showConfig: true });
          const executor2 = createExecutor({
            // showConfig: true,
            benchmark: true
          });
          const executor3 = createExecutor({
            // showConfig: true,
            benchmark: true,
            baseline: true
          });

          await executor.resolveConfig();
          assert.notProperty(executor.config, 'benchmarkConfig');

          await executor2.resolveConfig();
          assert.property(executor2.config, 'benchmarkConfig');
          assert.propertyVal(
            executor2.config.benchmarkConfig,
            'id',
            'Benchmark'
          );
          assert.propertyVal(executor2.config.benchmarkConfig, 'mode', 'test');

          await executor3.resolveConfig();
          assert.propertyVal(
            executor3.config.benchmarkConfig,
            'mode',
            'baseline'
          );
        },

        cancellation() {
          const test1Spy = spy(
            () => new Promise(resolve => setTimeout(resolve, 500))
          );
          const test2Spy = spy(
            () => new Promise(resolve => setTimeout(resolve, 500))
          );
          let suiteSpy: SinonSpy<any>;
          let suite: Suite;

          executor.addSuite(rootSuite => {
            suite = rootSuite;
            rootSuite.add(
              new Test({
                name: 'cancel test 1',
                test: test1Spy
              })
            );
            rootSuite.add(
              new Test({
                name: 'cancel test 2',
                test: test2Spy
              })
            );
            suiteSpy = spy(rootSuite, 'run');
          });

          const runPromise = executor.run();

          setTimeout(() => {
            executor.cancel();
          }, 200);

          return runPromise.then(
            () => {
              throw new Error('Run should not have passed');
            },
            error => {
              assert.isTrue(isCancel(error), 'error should be a cancellation');
              assert.equal(
                suiteSpy.callCount,
                1,
                'suite should have been started'
              );
              assert.equal(
                test1Spy.callCount,
                1,
                'test 1 should have been started'
              );
              assert.isFalse(
                test2Spy.called,
                'test 2 should not have been started'
              );
              assert.isDefined(suite.skip, 'suite should have been skipped');
            }
          );
        }
      }
    }
  };
});
