import { mockImport } from '@theintern-dev/test-util';
import { createSandbox, spy } from 'sinon';
import { global } from '@theintern/common';

import { LoaderInit } from 'src/lib/executors/Executor';

const originalIntern = global.intern;
const originalRequire = global.require;
const originalSystemJS = global.SystemJS;

registerSuite('loaders/systemjs', function () {
  const sandbox = createSandbox();

  const mockIntern = {
    // Use whatever the local environment is
    environment: intern.environment,
    config: { basePath: '/' },
    emit: sandbox.spy(() => {}),
    loadScript: sandbox.spy(() => {
      global.SystemJS = mockSystemJS;
      return Promise.resolve();
    }),
    log: sandbox.spy(() => {}),

    // registerLoader will be called once when the loader is imported, and isn't
    // something that should be reset between tests, so don't use the sandbox
    registerLoader: spy((_init: LoaderInit) => {})
  };

  const mockSystemJS = {
    config: sandbox.spy(() => {}),
    import: (_mod: string) => Promise.resolve()
  };
  const mockSystemJSImport = sandbox.stub(mockSystemJS, 'import').resolves();

  const fakeRequire: any = sandbox.spy((_module: string) => {
    return mockSystemJS;
  });

  return {
    async before() {
      global.intern = mockIntern;
      await mockImport(() => require('src/loaders/systemjs'));
      assert.equal(mockIntern.registerLoader.callCount, 1);
    },

    after() {
      global.intern = originalIntern;
      global.require = originalRequire;
      global.SystemJS = originalSystemJS;
    },

    beforeEach() {
      global.require = fakeRequire;
      global.SystemJS = undefined;
      sandbox.resetHistory();
    },

    tests: {
      init() {
        const init = mockIntern.registerLoader.getCall(0).args[0];
        return Promise.resolve(init({})).then(() => {
          if (intern.environment === 'browser') {
            assert.equal(mockIntern.loadScript.callCount, 1);
          }
        });
      },

      'load Modules'() {
        const init = mockIntern.registerLoader.getCall(0).args[0];
        return Promise.resolve(init({})).then(loader => {
          return loader(['foo.js']).then(() => {
            assert.equal(mockSystemJSImport.callCount, 1);
            assert.deepEqual(mockSystemJSImport.getCall(0).args[0], 'foo.js');
          });
        });
      },

      error() {
        const init = mockIntern.registerLoader.getCall(0).args[0];
        return Promise.resolve(init({})).then(loader => {
          const error = new Error('fail');
          mockSystemJSImport.callsFake(() => Promise.reject(error));

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
