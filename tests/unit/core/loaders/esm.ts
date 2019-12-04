import { createSandbox } from 'sinon';
import { global } from 'src/common';

import { LoaderInit } from 'src/core/lib/executors/Executor';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

const originalIntern = global.intern;

registerSuite('loaders/esm', () => {
  const sandbox = createSandbox();
  let removeMocks: () => void;
  let init: LoaderInit;

  const mockIntern = {
    environment: 'browser',
    config: { basePath: '/' },
    emit: sandbox.spy(() => {}),
    loadScript: sandbox.stub().resolves(),
    registerLoader: sandbox.spy((_init: LoaderInit) => {}),
    log: sandbox.spy(() => {})
  };

  return {
    before() {
      global.intern = mockIntern;
      return mockRequire(require, 'src/loaders/esm', {}).then(handle => {
        removeMocks = handle.remove;
        assert.equal(mockIntern.registerLoader.callCount, 1);
        init = mockIntern.registerLoader.args[0][0];
      });
    },

    after() {
      removeMocks();
    },

    beforeEach() {
      global.intern = mockIntern;
    },

    afterEach() {
      global.intern = originalIntern;
      sandbox.resetHistory();
      mockIntern.environment = 'browser';
    },

    tests: {
      init: {
        normal() {
          return Promise.resolve(init({})).then(() => {
            assert.equal(mockIntern.loadScript.callCount, 0);
          });
        },

        'non-browser'() {
          mockIntern.environment = 'node';
          assert.throws(() => {
            init({});
          }, /The ESM loader only works in the browser/);
        }
      },

      'load Modules'() {
        return Promise.resolve(init({})).then(loader => {
          return loader(['foo.js']).then(() => {
            assert.equal(mockIntern.loadScript.callCount, 1);
            assert.deepEqual(mockIntern.loadScript.getCall(0).args, [
              ['foo.js'],
              true
            ]);
          });
        });
      },

      error() {
        mockIntern.loadScript.rejects(new Error('fail'));
        return Promise.resolve(init({})).then(loader => {
          return loader(['foo.js']).then(
            () => {
              throw new Error('should not have succeeded');
            },
            error => {
              assert.match(error.message, /fail/);
            }
          );
        });
      }
    }
  };
});
