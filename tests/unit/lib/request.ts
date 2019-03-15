import * as moxios from 'moxios';
import request, { Response } from '../../../src/lib/request';

const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

registerSuite('lib/request', {
  beforeEach() {
    moxios.install();
  },

  afterEach() {
    moxios.uninstall();
  },

  tests: {
    response() {
      const dfd = this.async();

      moxios.wait(
        dfd.rejectOnError(() => {
          const request = moxios.requests.mostRecent();
          assert.match(request.config.method!, /^get$/i, 'Unexpected method');
          request.respondWith({
            status: 200,
            statusText: 'OK',
            response: 'foo',
            headers: {
              'Content-Type': 'text/plain',
              'A-Test-Header': 'Some Value'
            }
          });
        })
      );

      request('test.html')
        .then(
          dfd.rejectOnError((response: Response) => {
            assert.propertyVal(
              response,
              'status',
              200,
              'Unexpected status value'
            );
            assert.isTrue(response.ok, 'Expected response to be OK');
            assert.propertyVal(
              response,
              'statusText',
              'OK',
              'Unexpected statusText value'
            );
            assert.equal(
              response.headers.get('content-type'),
              'text/plain',
              'Unexpected content type'
            );
            assert.equal(
              response.headers.all['content-type'],
              'text/plain',
              'Unexpected content type for content-type'
            );
            assert.equal(
              response.headers.all['a-test-header'],
              'Some Value',
              'Unexpected content type for a-test-header'
            );
            return response.text();
          })
        )
        .then(
          dfd.callback((data: string) => {
            assert.equal(data, 'foo', 'Unexpected data value');
          })
        );
    },

    'bad response'() {
      const dfd = this.async();

      moxios.wait(() => {
        const request = moxios.requests.mostRecent();
        request.respondWith({
          status: 400,
          statusText: 'Not Found'
        });
      });

      request('test.html').then(
        dfd.callback((response: Response) => {
          assert.propertyVal(
            response,
            'status',
            400,
            'Unexpected status value'
          );
          assert.isFalse(response.ok, 'Expected response to not be OK');
          assert.propertyVal(
            response,
            'statusText',
            'Not Found',
            'Unexpected statusText value'
          );
          return response.text();
        })
      );
    },

    cancel() {
      const dfd = this.async();
      let responded = false;

      moxios.wait(() => {
        const request = moxios.requests.mostRecent();
        setTimeout(() => {
          responded = true;
          request.respondWith({
            status: 200,
            statusText: 'OK'
          });
        }, 1000);
      });

      const req = request('test.html');

      req
        .then(
          dfd.rejectOnError(() => {
            assert.fail("Shouldn't not have resolved");
          })
        )
        .finally(
          dfd.callback(() => {
            assert.isFalse(responded, 'Should not have responded');
          })
        );

      req.cancel();
    },

    'download progress'() {
      const dfd = this.async();
      let progressed = false;

      moxios.wait(() => {
        const request = moxios.requests.mostRecent();
        request.respondWith({ status: 200, response: 'foo' });
      });

      request('test.html', {
        onDownloadProgress: () => {
          progressed = true;
        }
      }).then(
        dfd.callback(() => {
          assert.isTrue(progressed);
        })
      );
    },

    auth() {
      const dfd = this.async();

      moxios.wait(
        dfd.callback(() => {
          const request = moxios.requests.mostRecent();
          assert.deepEqual(request.config.auth, {
            username: 'user',
            password: 'pass'
          });
        })
      );

      request('test.html', {
        username: 'user',
        password: 'pass'
      });
    },

    proxy() {
      const dfd = this.async();

      moxios.wait(
        dfd.callback(() => {
          const request = moxios.requests.mostRecent();
          // moxios typings don't yet understand the 'auth' property
          assert.deepEqual(request.config.proxy, <any>{
            host: 'thing.local',
            port: 8080,
            auth: {
              username: 'user',
              password: 'pass'
            }
          });
        })
      );

      request('test.html', {
        proxy: 'http://user:pass@thing.local:8080'
      });
    },

    get() {
      const dfd = this.async();

      moxios.wait(
        dfd.rejectOnError(() => {
          const request = moxios.requests.mostRecent();
          assert.match(request.config.method!, /^get$/i, 'Unexpected method');
          request.respondWith({
            status: 200,
            response: JSON.stringify([{ name: 'foo' }])
          });
        })
      );

      request('test.html')
        .then(
          dfd.rejectOnError((response: Response) => {
            assert.propertyVal(
              response,
              'status',
              200,
              'Unexpected status value'
            );
            return response.json();
          })
        )
        .then(
          dfd.callback((data: object) => {
            assert.deepEqual(
              data,
              [{ name: 'foo' }],
              'Unexpected data property'
            );
          })
        );
    },

    delete() {
      const dfd = this.async();

      moxios.wait(
        dfd.rejectOnError(() => {
          const request = moxios.requests.mostRecent();
          assert.match(
            request.config.method!,
            /^delete$/i,
            'Unexpected method'
          );
          request.respondWith({ status: 204 });
        })
      );

      request('test.html', { method: 'delete' }).then(
        dfd.callback((response: Response) => {
          assert.equal(response.status, 204, 'Unexpected status');
        })
      );
    },

    head() {
      const dfd = this.async();

      moxios.wait(
        dfd.rejectOnError(() => {
          const request = moxios.requests.mostRecent();
          assert.match(request.config.method!, /^head$/i, 'Unexpected method');
          request.respondWith({ status: 204 });
        })
      );

      request('test.html', { method: 'head' }).then(
        dfd.callback((response: Response) => {
          assert.equal(response.status, 204, 'Unexpected status');
        })
      );
    },

    options() {
      const dfd = this.async();

      moxios.wait(
        dfd.rejectOnError(() => {
          const request = moxios.requests.mostRecent();
          assert.match(
            request.config.method!,
            /^options$/i,
            'Unexpected method'
          );
          request.respondWith({ status: 204 });
        })
      );

      request('test.html', { method: 'options' }).then(
        dfd.callback((response: Response) => {
          assert.equal(response.status, 204, 'Unexpected status');
        })
      );
    },

    post() {
      const dfd = this.async();

      moxios.wait(
        dfd.rejectOnError(() => {
          const request = moxios.requests.mostRecent();
          assert.match(request.config.method!, /^post$/i, 'Unexpected method');
          assert.deepEqual(request.config.data, 'some body');
          request.respondWith({ status: 204 });
        })
      );

      request('test.html', {
        method: 'post',
        data: 'some body'
      }).then(dfd.callback(() => {}));
    },

    put() {
      const dfd = this.async();

      moxios.wait(
        dfd.rejectOnError(() => {
          const request = moxios.requests.mostRecent();
          assert.match(request.config.method!, /^put$/i, 'Unexpected method');
          assert.deepEqual(request.config.data, 'some body');
          request.respondWith({ status: 204 });
        })
      );

      request('test.html', {
        method: 'put',
        data: 'some body'
      }).then(dfd.callback(() => {}));
    }
  }
});
