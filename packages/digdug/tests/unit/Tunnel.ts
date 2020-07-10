import { createCancelToken, isCancel } from '@theintern/common';

import Tunnel from '../../src/Tunnel';

registerSuite('Tunnel', () => {
  let tunnel: Tunnel;

  return {
    beforeEach() {
      tunnel = new Tunnel(<any>{ foo: 'bar' });
    },

    tests: {
      '#clientUrl'() {
        tunnel.port = '4446';
        tunnel.hostname = 'foo.com';
        tunnel.protocol = 'https';
        tunnel.pathname = 'bar/baz/';
        assert.strictEqual(tunnel.clientUrl, 'https://foo.com:4446/bar/baz/');
      },

      '#extraCapabilities'() {
        assert.deepEqual(tunnel.extraCapabilities, {});
      },

      '#start'() {
        const promise = Promise.resolve();
        tunnel['_startPromise'] = promise;
        tunnel['_state'] = <Tunnel['_state']>'stopping';
        assert.throws(() => {
          tunnel.start();
        });

        tunnel['_state'] = 'running';
        assert.strictEqual(
          tunnel.start(),
          promise,
          'Running tunnel should have returned start promise'
        );
      },

      '#stop': {
        'stop a stopping tunnel'() {
          (<any>tunnel)._state = 'stopping';
          return tunnel.stop();
        },

        'stop a starting tunnnel'() {
          const cancelToken = createCancelToken();
          let resolved = false;

          const startPromise = cancelToken
            .wrap(
              new Promise(resolve => {
                global.setTimeout(resolve, 500);
              })
            )
            .then(() => {
              resolved = true;
            });

          tunnel['_state'] = 'starting';
          tunnel['_startPromise'] = startPromise;
          tunnel['_stop'] = () => Promise.resolve(0);
          tunnel['_cancelToken'] = cancelToken;

          tunnel.stop();

          return startPromise
            .catch(error => {
              assert.isTrue(
                isCancel(error),
                'Tunnel should have been cancelled'
              );
            })
            .finally(() => {
              assert.isFalse(
                resolved,
                'Tunnel startup promise should not have resolved'
              );
            });
        },

        'stop a tunnel that is not running; throws'() {
          (<any>tunnel)['_state'] = 'stopped';
          (<any>tunnel)['_stop'] = () => Promise.resolve(0);
          (<any>tunnel)['_handle'] = { destroy() {} };
          return tunnel.stop();
        }
      },

      '#sendJobState'() {
        const dfd = this.async();
        tunnel.sendJobState('0', { success: true }).catch(function () {
          dfd.resolve();
        });
      }
    }
  };
});
