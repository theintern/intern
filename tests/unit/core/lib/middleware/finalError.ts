import createError from 'http-errors';
import { spy, SinonSpy } from 'sinon';

import finalError from 'src/core/lib/middleware/finalError';
import { MockRequest, MockResponse } from 'tests/support/unit/mocks';

registerSuite('lib/middleware/finalError', function() {
  let handler: (error: any, request: any, response: any, next: any) => void;
  let request: MockRequest;
  let response: MockResponse;
  let next: SinonSpy;

  return {
    beforeEach() {
      handler = finalError();
      request = new MockRequest('GET', '/foo/bar.js');
      response = new MockResponse();
      next = spy();
    },

    tests: {
      'exposed message'() {
        const error = createError(500, 'b0rked', { expose: true });

        handler(error, request, response, next);

        assert.isFalse(next.called);
        assert.match(response.data, /500 b0rked/);
        assert.strictEqual(response.statusCode, 500);
      },

      'hidden message'() {
        const error = createError(404, 'b0rked', { expose: false });

        handler(error, request, response, next);

        assert.isFalse(next.called);
        assert.match(response.data, /404 Not Found/);
        assert.strictEqual(response.statusCode, 404);
      }
    }
  };
});
