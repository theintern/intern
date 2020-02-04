import { mockImport } from 'tests/support/mockUtil';
import { spy, SinonSpy } from 'sinon';

import _Http from 'src/core/lib/channels/Http';

let Http: typeof _Http;

registerSuite('core/lib/channels/Http', function() {
  const mockRequest = spy((path: string, data: any) => {
    if (requestHandler) {
      return requestHandler(path, data);
    }
    const result = requestData && requestData[path];
    return Promise.resolve(result);
  });

  let requestData: { [name: string]: string };
  let requestHandler: SinonSpy<[string, any]> | undefined;

  return {
    async before() {
      ({ default: Http } = await mockImport(
        () => import('src/core/lib/channels/Http'),
        replace => {
          replace(() => import('src/common')).with({
            request: mockRequest
          });
        }
      ));
    },

    beforeEach() {
      requestHandler = undefined;
    },

    tests: {
      '#sendMessage'() {
        const http = new Http({ sessionId: 'foo', url: 'bar' });

        // Alternate between 200 and 204 status codes
        let count = 0;

        requestHandler = spy(
          (_path: string, data: any) =>
            new Promise<any>((resolve, reject) => {
              // Auto-respond to a request after a short timeout
              setTimeout(() => {
                try {
                  const items = data.data.map(JSON.parse);
                  if (count % 2 === 0) {
                    const responses: any[] = [];
                    for (const item of items) {
                      responses.push({
                        id: item.id,
                        data: item.data.toUpperCase()
                      });
                    }
                    resolve({
                      status: 200,
                      json: () => Promise.resolve(responses)
                    });
                  } else {
                    resolve({ status: 204, json: () => '' });
                  }
                  count++;
                } catch (error) {
                  reject(error);
                  console.log('data body:', data.body);
                }
              }, 100);
            })
        );

        const send1 = http.sendMessage('remoteStatus', 'foo');
        const send2 = http.sendMessage('remoteStatus', 'bar');
        const send3 = http.sendMessage('remoteStatus', 'baz');

        return Promise.all([send1, send2, send3]).then(results => {
          // First send is a request, and the other two will queue up
          // and be be sent together in a second request
          assert.equal(requestHandler!.callCount, 2);

          assert.lengthOf(results, 3, 'expected 3 results');

          // Each message should have its own response
          assert.deepEqual(results[0], { id: '1', data: 'FOO' });
          // The second and third requests don't come back with any
          // data, just a 204 status code
          assert.deepEqual(results[1], undefined);
          assert.deepEqual(results[2], undefined);
        });
      },

      '#sendMessage error'() {
        const http = new Http({ sessionId: 'foo', url: 'bar' });

        requestHandler = spy((_path: string, _data: any) => {
          return new Promise<any>(resolve => {
            // Auto-respond to a request after a short timeout
            setTimeout(() => {
              resolve({ status: 500, statusText: 'badness' });
            }, 100);
          });
        });

        const send1 = http.sendMessage('remoteStatus', 'foo');

        return send1.then(
          () => {
            throw new Error('expected send to fail');
          },
          error => {
            assert.match(error.message, /badness/, 'unexpected error response');
          }
        );
      }
    }
  };
});
