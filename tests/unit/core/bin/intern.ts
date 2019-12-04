import { createSandbox, SinonStub, SinonSpy } from 'sinon';
import { Task, global } from 'src/common';
import { getPackagePath } from 'src/core/lib/node/util';

import {
  createMockBrowserExecutor,
  createMockConsole,
  createMockNodeExecutor,
  MockConsole
} from 'tests/support/unit/mocks';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');
const originalIntern = global.intern;

registerSuite('bin/intern', function() {
  const sandbox = createSandbox();
  const mockNodeUtil: { [name: string]: SinonSpy<any, any> } = {
    getConfig: sandbox.spy((..._args: any[]) => {
      return Task.resolve({ config: configData, file: 'intern.json' });
    }),
    getPackagePath: sandbox.spy(() => getPackagePath())
  };

  const originalExitCode = process.exitCode;

  let configData: any;
  let removeMocks: (() => void) | undefined;
  let mockConsole: MockConsole;
  let mockCommonUtil: { [name: string]: SinonStub };

  return {
    beforeEach() {
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
        return mockRequire(require, 'src/core/bin/intern', {
          'src/core/lib/node/util': mockNodeUtil,
          'src/core/lib/common/console': mockConsole,
          'src/core/lib/common/util': mockCommonUtil,
          'src/core/index': mockExecutor,
          'src/common': { global: { process: {} } }
        }).then(handle => {
          removeMocks = handle.remove;
          assert.equal(mockNodeUtil.getConfig.callCount, 1);
          assert.equal(mockCommonUtil.getConfigDescription.callCount, 0);
          assert.isTrue(mockExecutor._ran, 'expected executor to have run');
        });
      },

      'ts in node'() {
        configData = {
          suites: ['foo.ts'],
          plugins: ['bar.ts']
        };
        const mockExecutor = createMockNodeExecutor({
          environment: 'node'
        } as any);
        return mockRequire(require, 'src/core/bin/intern', {
          'src/core/lib/node/util': mockNodeUtil,
          'src/core/lib/common/console': mockConsole,
          'src/core/lib/common/util': mockCommonUtil,
          'src/core/index': mockExecutor,
          'src/common': { global: { process: {} } }
        }).then(handle => {
          removeMocks = handle.remove;
          assert.equal(mockNodeUtil.getConfig.callCount, 1);
          assert.equal(mockCommonUtil.getConfigDescription.callCount, 0);
          assert.isTrue(mockExecutor._ran, 'expected executor to have run');
        });
      },

      'show configs'() {
        configData = { showConfigs: true };

        return mockRequire(require, 'src/core/bin/intern', {
          'src/core/lib/node/util': mockNodeUtil,
          'src/core/lib/common/console': mockConsole,
          'src/core/lib/common/util': mockCommonUtil,
          'src/core/index': createMockNodeExecutor(),
          'src/common': { global: { process: {} } }
        }).then(handle => {
          removeMocks = handle.remove;
          assert.equal(mockNodeUtil.getConfig.callCount, 1);
          assert.equal(mockCommonUtil.getConfigDescription.callCount, 1);
          assert.deepEqual(mockConsole.log.args, [['test config']]);
        });
      },

      'bad run': {
        'intern defined'() {
          return mockRequire(require, 'src/core/bin/intern', {
            'src/core/lib/node/util': mockNodeUtil,
            'src/core/lib/common/console': mockConsole,
            'src/core/lib/common/util': mockCommonUtil,
            'src/core/index': createMockNodeExecutor(),
            'src/common': { global: { process: {} } }
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

          return mockRequire(require, 'src/core/bin/intern', {
            'src/core/lib/node/util': mockNodeUtil,
            'src/core/lib/common/console': mockConsole,
            'src/core/lib/common/util': mockCommonUtil,
            'src/core/index': createMockNodeExecutor(),
            'src/common': {
              global: { process: { stdout: process.stdout } }
            }
          })
            .then(handle => {
              removeMocks = handle.remove;
              return new Promise(resolve => setTimeout(resolve, 10));
            })
            .then(() => {
              assert.equal(
                mockConsole.error.callCount,
                1,
                'expected error to be called once'
              );
            });
        },

        'ts in suites in the browser'() {
          configData = {
            suites: ['foo.ts']
          };
          const mockExecutor = createMockBrowserExecutor({
            environment: 'browser'
          } as any);
          return mockRequire(require, 'src/core/bin/intern', {
            'src/core/lib/node/util': mockNodeUtil,
            'src/core/lib/common/console': mockConsole,
            'src/core/lib/common/util': mockCommonUtil,
            'src/core/index': mockExecutor,
            'src/common': { global: { process: {} } }
          }).then(handle => {
            removeMocks = handle.remove;
            assert.equal(mockNodeUtil.getConfig.callCount, 1);
            assert.equal(mockCommonUtil.getConfigDescription.callCount, 0);
            assert.isFalse(
              mockExecutor._ran,
              'expected executor not to have run'
            );
          });
        },

        'ts in plugins in the browser'() {
          configData = {
            plugins: ['foo.ts']
          };
          const mockExecutor = createMockBrowserExecutor({
            environment: 'browser'
          } as any);
          return mockRequire(require, 'src/core/bin/intern', {
            'src/core/lib/node/util': mockNodeUtil,
            'src/core/lib/common/console': mockConsole,
            'src/core/lib/common/util': mockCommonUtil,
            'src/core/index': mockExecutor,
            'src/common': { global: { process: {} } }
          }).then(handle => {
            removeMocks = handle.remove;
            assert.equal(mockNodeUtil.getConfig.callCount, 1);
            assert.equal(mockCommonUtil.getConfigDescription.callCount, 0);
            assert.isFalse(
              mockExecutor._ran,
              'expected executor not to have run'
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

        return mockRequire(require, 'src/core/bin/intern', {
          'src/core/lib/node/util': mockNodeUtil,
          'src/core/lib/common/console': mockConsole,
          'src/core/lib/common/util': mockCommonUtil,
          'src/core/index': mockExecutor,
          'src/common': { global: { process: {} } }
        }).then(handle => {
          removeMocks = handle.remove;
          assert.match(mockConsole.log.args[0][0], /intern version \d/);
          assert.match(mockConsole.log.args[1][0], /npm version \d/);
          assert.match(mockConsole.log.args[2][0], /node version v\d/);
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
