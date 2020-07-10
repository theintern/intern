import { mockImport } from 'tests/support/mockUtil';
import { createSandbox, SinonStub, SinonSpy } from 'sinon';
import { global } from '@theintern/common';

import * as nodeUtil from 'src/lib/node/util';

import {
  createMockBrowserExecutor,
  createMockConsole,
  createMockNodeExecutor,
  MockConsole
} from 'tests/support/unit/mocks';

const originalIntern = global.intern;
const originalGetPackagePath = nodeUtil.getPackagePath;

registerSuite('bin/intern', function () {
  const sandbox = createSandbox();
  const mockNodeUtil: { [name: string]: SinonSpy } = {
    getConfig: sandbox.spy((..._args: any[]) => {
      return Promise.resolve({ config: configData, file: 'intern.json' });
    }),
    getPackagePath: sandbox.spy(() => originalGetPackagePath())
  };

  const originalExitCode = process.exitCode;

  let configData: any;
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
      process.exitCode = originalExitCode;
      global.intern = originalIntern;
    },

    tests: {
      async 'basic run'() {
        const mockExecutor = createMockNodeExecutor();

        await mockImport(
          () => import('src/bin/intern'),
          replace => {
            replace(() => import('src/lib/node/util')).with(mockNodeUtil);
            replace(() => import('src/lib/common/util')).with(mockCommonUtil);
            replace(() => import('src/index')).withDefault(mockExecutor);
            replace(() => import('@theintern/common')).with({
              global: { process: {} }
            });
          }
        );

        assert.equal(mockNodeUtil.getConfig.callCount, 1);
        assert.equal(mockCommonUtil.getConfigDescription.callCount, 0);
        assert.isTrue(mockExecutor._ran, 'expected executor to have run');
      },

      async 'ts in node'() {
        configData = {
          suites: ['foo.ts'],
          plugins: ['bar.ts']
        };
        const mockExecutor = createMockNodeExecutor({
          environment: 'node'
        } as any);

        await mockImport(
          () => import('src/bin/intern'),
          replace => {
            replace(() => import('src/lib/node/util')).with(mockNodeUtil);
            replace(() => import('src/lib/common/util')).with(mockCommonUtil);
            replace(() => import('src/index')).withDefault(mockExecutor);
            replace(() => import('@theintern/common')).with({
              global: { process: {} }
            });
            replace(() => import('src/lib/common/console')).with(mockConsole);
          }
        );

        assert.equal(mockNodeUtil.getConfig.callCount, 1);
        assert.equal(mockCommonUtil.getConfigDescription.callCount, 0);
        assert.isTrue(mockExecutor._ran, 'expected executor to have run');
      },

      async 'show configs'() {
        configData = { showConfigs: true };

        await mockImport(
          () => import('src/bin/intern'),
          replace => {
            replace(() => import('src/lib/node/util')).with(mockNodeUtil);
            replace(() => import('src/lib/common/util')).with(mockCommonUtil);
            replace(() => import('src/index')).withDefault(
              createMockNodeExecutor()
            );
            replace(() => import('@theintern/common')).with({
              global: { process: {} }
            });
            replace(() => import('src/lib/common/console')).with(mockConsole);
          }
        );

        assert.equal(mockNodeUtil.getConfig.callCount, 1);
        assert.equal(mockCommonUtil.getConfigDescription.callCount, 1);
        assert.deepEqual(mockConsole.log.args, [['test config']]);
      },

      'bad run': {
        async 'intern defined'() {
          await mockImport(
            () => import('src/bin/intern'),
            replace => {
              replace(() => import('src/lib/node/util')).with(mockNodeUtil);
              replace(() => import('src/lib/common/util')).with(mockCommonUtil);
              replace(() => import('src/index')).withDefault(
                createMockNodeExecutor()
              );
              replace(() => import('@theintern/common')).with({
                global: { process: {} }
              });
              replace(() => import('src/lib/common/console')).with(mockConsole);
            }
          );

          assert.equal(
            mockConsole.error.callCount,
            0,
            'expected error not to be called'
          );
        },

        async 'intern not defined'() {
          configData = { showConfigs: true };
          mockCommonUtil.getConfigDescription.throws();

          await mockImport(
            () => import('src/bin/intern'),
            replace => {
              replace(() => import('src/lib/node/util')).with(mockNodeUtil);
              replace(() => import('src/lib/common/util')).with(mockCommonUtil);
              replace(() => import('src/index')).withDefault(
                createMockNodeExecutor()
              );
              replace(() => import('@theintern/common')).with({
                global: { process: { stdout: process.stdout } }
              });
              replace(() => import('src/lib/common/console')).with(mockConsole);
            }
          );
          await new Promise(resolve => setTimeout(resolve, 10));

          assert.equal(
            mockConsole.error.callCount,
            1,
            'expected error to be called once'
          );
        },

        // TODO: Move this test to somewhere browsery since core/bin/intern only
        // runs in Node
        async 'ts in suites in the browser'() {
          configData = {
            suites: ['foo.ts']
          };
          const mockExecutor = createMockBrowserExecutor({
            environment: 'browser'
          } as any);

          await mockImport(
            () => import('src/bin/intern'),
            replace => {
              replace(() => import('src/lib/node/util')).with(mockNodeUtil);
              replace(() => import('src/lib/common/util')).with(mockCommonUtil);
              replace(() => import('src/index')).withDefault(
                mockExecutor as any
              );
              replace(() => import('@theintern/common')).with({
                global: { process: {} }
              });
              replace(() => import('src/lib/common/console')).with(mockConsole);
            }
          );

          assert.equal(mockNodeUtil.getConfig.callCount, 1);
          assert.equal(mockCommonUtil.getConfigDescription.callCount, 0);
          assert.isFalse(
            mockExecutor._ran,
            'expected executor not to have run'
          );
        },

        // TODO: Move this test to somewhere browsery since core/bin/intern only
        // runs in Node
        async 'ts in plugins in the browser'() {
          configData = {
            plugins: ['foo.ts']
          };
          const mockExecutor = createMockBrowserExecutor({
            environment: 'browser'
          } as any);

          await mockImport(
            () => import('src/bin/intern'),
            replace => {
              replace(() => import('src/lib/node/util')).with(mockNodeUtil);
              replace(() => import('src/lib/common/util')).with(mockCommonUtil);
              replace(() => import('src/index')).withDefault(
                mockExecutor as any
              );
              replace(() => import('@theintern/common')).with({
                global: { process: {} }
              });
              replace(() => import('src/lib/common/console')).with(mockConsole);
            }
          );

          assert.equal(mockNodeUtil.getConfig.callCount, 1);
          assert.equal(mockCommonUtil.getConfigDescription.callCount, 0);
          assert.isFalse(
            mockExecutor._ran,
            'expected executor not to have run'
          );
        }
      },

      async help() {
        const mockExecutor = createMockNodeExecutor(<any>{
          _config: {
            foo: 'one',
            bar: [2, 3],
            baz: { value: false }
          }
        });
        configData = { help: true };

        await mockImport(
          () => import('src/bin/intern'),
          replace => {
            replace(() => import('src/lib/node/util')).with(mockNodeUtil);
            replace(() => import('src/lib/common/util')).with(mockCommonUtil);
            replace(() => import('src/index')).withDefault(mockExecutor);
            replace(() => import('@theintern/common')).with({
              global: { process: {} }
            });
            replace(() => import('src/lib/common/console')).with(mockConsole);
          }
        );

        assert.match(mockConsole.log.args[0][0], /intern version \d/);
        assert.match(mockConsole.log.args[1][0], /npm version \d/);
        assert.match(mockConsole.log.args[2][0], /node version v\d/);
        assert.deepEqual(mockConsole.log.args.slice(4), [
          ['Usage: intern [config=<file>] [showConfig|showConfigs] [options]'],
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
      }
    }
  };
});
