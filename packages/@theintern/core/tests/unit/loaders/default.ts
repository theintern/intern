import { mockImport } from 'tests/support/mockUtil';
import { spy, stub } from 'sinon';
import { global } from '@theintern/common';

import { LoaderInit } from 'src/lib/executors/Executor';

const originalIntern = global.intern;
const originalRequire = global.require;

registerSuite('loaders/default', function () {
  const mockIntern = {
    config: { basePath: '/' },
    emit: spy(() => {}),
    loadScript: stub().resolves(),
    registerLoader: spy((_init: LoaderInit) => {}),
    log: spy(() => {}),
  };

  return {
    async before() {
      global.intern = mockIntern;
      await mockImport(() => require('src/loaders/default'));
      assert.equal(mockIntern.registerLoader.callCount, 1);
    },

    after() {
      global.intern = originalIntern;
    },

    beforeEach() {
      global.intern = mockIntern;
      mockIntern.emit.resetHistory();
      mockIntern.loadScript.reset();
      mockIntern.loadScript.resolves();
    },

    afterEach() {
      global.intern = originalIntern;
      global.require = originalRequire;
    },

    tests: {
      init() {
        const init = mockIntern.registerLoader.getCall(0).args[0];
        return Promise.resolve(init({})).then(() => {
          // The default loader doesn't do anythign in its init
          // function
          assert.equal(mockIntern.loadScript.callCount, 0);
        });
      },

      'load Modules'() {
        const init: LoaderInit = mockIntern.registerLoader.getCall(0).args[0];
        return Promise.resolve(init({})).then((loader) => {
          return loader(['foo.js']).then(() => {
            assert.equal(mockIntern.loadScript.callCount, 1);
            assert.equal(mockIntern.loadScript.getCall(0).args[0], 'foo.js');
          });
        });
      },

      error() {
        const init: LoaderInit = mockIntern.registerLoader.getCall(0).args[0];
        mockIntern.loadScript.rejects(new Error('fail'));
        return Promise.resolve(init({})).then((loader) => {
          return loader(['foo.js']).then(
            () => {
              throw new Error('should not have succeeded');
            },
            (error) => {
              assert.match(error.message, /fail/);
            }
          );
        });
      },
    },
  };
});
