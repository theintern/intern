import { mockImport } from 'tests/support/mockUtil';
import { useFakeTimers, SinonFakeTimers } from 'sinon';
import { Task } from 'src/common';

let WebSocket: typeof import('src/core/lib/channels/WebSocket').default;

registerSuite('core/lib/channels/WebSocket', function() {
  class MockWebSocket {
    addEventListener(name: string, callback: (event: any) => void) {
      if (!eventListeners[name]) {
        eventListeners[name] = [];
      }
      eventListeners[name].push(callback);
    }

    send(data: string) {
      sentData.push(data);
    }
  }

  let eventListeners: { [name: string]: ((event: any) => void)[] };
  let sentData: string[];
  let clock: SinonFakeTimers;

  return {
    async before() {
      ({ default: WebSocket } = await mockImport(
        () => import('src/core/lib/channels/WebSocket'),
        replace => {
          replace(() => import('src/common')).with({
            global: { WebSocket: MockWebSocket },
            Task
          });
          replace(() => import('src/core/lib/browser/util')).with({
            parseUrl: () => ({} as any)
          });
        }
      ));
    },

    beforeEach() {
      eventListeners = {};
      sentData = [];
      clock = useFakeTimers();
    },

    afterEach() {
      clock.restore();
    },

    tests: {
      'required args'() {
        assert.throws(() => {
          new WebSocket({ sessionId: 'foo', url: 'bar' });
        }, /port is required/);
      },

      '#sendMessage': {
        good() {
          const ws = new WebSocket({
            sessionId: 'foo',
            url: 'bar',
            port: 12345
          });
          assert.lengthOf(eventListeners['message'], 1);
          assert.lengthOf(eventListeners['open'], 1);
          // There are 2 error handlers, one for the initial
          // connection and one for later errors
          assert.lengthOf(eventListeners['error'], 2);

          // Send an open event to the socket so sendMessage will
          // proceed
          eventListeners['open'][0]({});

          const sent = ws.sendMessage('remoteStatus', 'foo');
          let messageId: string;

          return Promise.resolve()
            .then(() => {
              assert.lengthOf(sentData, 1);
              const message = JSON.parse(sentData[0]);
              messageId = message.id;

              // Send a response
              eventListeners['message'][0]({
                data: JSON.stringify({
                  id: messageId,
                  data: 'bar'
                })
              });

              return sent;
            })
            .then(response => {
              assert.deepEqual(response, {
                id: messageId,
                data: 'bar'
              });
            });
        },

        error() {
          const ws = new WebSocket({
            sessionId: 'foo',
            url: 'bar',
            port: 12345
          });
          eventListeners['open'][0]({});

          const sent = ws.sendMessage('remoteStatus', 'foo');

          return Promise.resolve()
            .then(() => {
              assert.lengthOf(sentData, 1);

              // Call the second error handler
              eventListeners['error'][1]({});

              return sent;
            })
            .then(
              () => {
                throw new Error('Send should not have succeeded');
              },
              error => {
                assert.match(error.message, /WebSocket error/);
              }
            )
            .then(() => {
              // A subsequent send should automatically fail
              return ws.sendMessage('remoteStatus', 'foo');
            })
            .then(
              () => {
                throw new Error('Send should not have succeeded');
              },
              error => {
                assert.match(error.message, /WebSocket error/);
              }
            );
        }
      }
    }
  };
});
