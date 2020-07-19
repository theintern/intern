import { mockImport } from '@theintern-dev/test-util';
import { createSandbox } from 'sinon';

const sandbox = createSandbox();
const mockConsole = {
  log: sandbox.spy(() => {}),
  warn: sandbox.spy(() => {}),
  error: sandbox.spy(() => {})
};

let console: typeof import('src/lib/common/console');

registerSuite('lib/common/console', {
  afterEach() {
    sandbox.resetHistory();
  },

  tests: {
    'console exists': {
      async before() {
        console = await mockImport(
          () => import('src/lib/common/console'),
          replace => {
            replace(() => import('@theintern/common')).with({
              global: { console: mockConsole }
            });
          }
        );
      },

      tests: {
        log() {
          console.log('foo', 5);
          assert.deepEqual(mockConsole.log.args, [['foo', 5]]);
        },

        warn() {
          console.warn('foo', 5);
          assert.deepEqual(mockConsole.warn.args, [['foo', 5]]);
        },

        error() {
          console.error('foo', 5);
          assert.deepEqual(mockConsole.error.args, [['foo', 5]]);
        }
      }
    },

    'console does not exist': {
      async before() {
        console = await mockImport(
          () => import('src/lib/common/console'),
          replace => {
            replace(() => import('@theintern/common')).with({
              global: { console: undefined }
            });
          }
        );
      },

      tests: {
        log() {
          assert.doesNotThrow(() => console.log('foo', 5));
          assert.equal(mockConsole.log.callCount, 0);
        },

        warn() {
          assert.doesNotThrow(() => console.warn('foo', 5));
          assert.equal(mockConsole.warn.callCount, 0);
        },

        error() {
          assert.doesNotThrow(() => console.error('foo', 5));
          assert.equal(mockConsole.error.callCount, 0);
        }
      }
    }
  }
});
