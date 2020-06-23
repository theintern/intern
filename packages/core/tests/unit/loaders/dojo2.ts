import { mockImport } from 'tests/support/mockUtil';
import { spy } from 'sinon';
import { global } from '@theintern/common';

import { LoaderInit } from 'src/lib/executors/Executor';

const originalIntern = global.intern;
const originalDojoConfig = global.dojoConfig;
const originalRequire = global.require;

registerSuite('loaders/dojo2', function () {
  const mockIntern = {
    config: { basePath: '/' },
    emit: spy(() => {}),
    loadScript: spy(() => Promise.resolve()),
    registerLoader: spy((_init: LoaderInit) => {}),
    log: spy(() => {})
  };

  const fakeRequire: any = spy((_modules: string[], callback: () => void) => {
    if (requirePromise) {
      requirePromise.then(callback);
    } else {
      callback();
    }
  });
  fakeRequire.on = spy(() => {
    return { remove() {} };
  });
  fakeRequire.config = spy(() => {});

  let requirePromise: Promise<void>;

  return {
    async before() {
      global.intern = mockIntern;
      await mockImport(() => require('src/loaders/dojo2'));
      assert.equal(mockIntern.registerLoader.callCount, 1);
    },

    after() {
      global.intern = originalIntern;
    },

    beforeEach() {
      global.intern = mockIntern;
      global.require = fakeRequire;
      mockIntern.emit.resetHistory();
      mockIntern.loadScript.resetHistory();
      fakeRequire.resetHistory();
      fakeRequire.on.resetHistory();
      fakeRequire.config.resetHistory();
    },

    afterEach() {
      global.intern = originalIntern;
      global.dojoConfig = originalDojoConfig;
      global.require = originalRequire;
    },

    tests: {
      init() {
        const init = mockIntern.registerLoader.getCall(0).args[0];
        return (init({}) as Promise<any>).then(() => {
          assert.equal(mockIntern.loadScript.callCount, 1);
        });
      },

      'load Modules'() {
        const init: LoaderInit = mockIntern.registerLoader.getCall(0).args[0];
        return Promise.resolve(init({})).then(loader => {
          return loader(['foo.js']).then(() => {
            assert.equal(fakeRequire.callCount, 1);
            assert.deepEqual(fakeRequire.getCall(0).args[0], ['foo.js']);
          });
        });
      },

      error() {
        const init: LoaderInit = mockIntern.registerLoader.getCall(0).args[0];
        return Promise.resolve(init({})).then(loader => {
          requirePromise = new Promise<void>(() => {});
          const error = new Error('fail');

          setTimeout(() => {
            assert.equal(fakeRequire.on.getCall(0).args[0], 'error');
            const errorHandler = fakeRequire.on.getCall(0).args[1];
            errorHandler(error);
          });

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
