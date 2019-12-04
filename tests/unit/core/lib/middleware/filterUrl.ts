import { spy, SinonSpy } from 'sinon';

import filterUrl from 'src/core/lib/middleware/filterUrl';
import { MockRequest, MockResponse } from 'tests/support/unit/mocks';

registerSuite('lib/middleware/filterUrl', function() {
  let handler: (request: any, response: any, next: any) => void;
  let request: MockRequest;
  let response: MockResponse;
  let next: SinonSpy;

  return {
    beforeEach() {
      handler = filterUrl();
      response = new MockResponse();
      next = spy();
    },

    tests: {
      'normal url'() {
        request = new MockRequest('GET', '/foo/bar.js');
        handler(request, response, next);

        assert.isTrue(next.called);
        assert.strictEqual(request.url, '/foo/bar.js');
      },

      'url with line number'() {
        request = new MockRequest('GET', '/foo/bar.js:85:85');
        handler(request, response, next);

        assert.isTrue(next.called);
        assert.strictEqual(request.url, '/foo/bar.js');
      },

      'url with query parameters'() {
        request = new MockRequest('GET', '/foo/bar.js?time=12:55');
        handler(request, response, next);

        assert.isTrue(next.called);
        assert.strictEqual(request.url, '/foo/bar.js?time=12:55');
      },

      'no url'() {
        request = new MockRequest('GET', undefined);
        handler(request, response, next);

        assert.isTrue(next.called);
        assert.isUndefined(request.url);
      }
    }
  };
});
