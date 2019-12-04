import { HttpError } from 'http-errors';
import { spy, SinonSpy } from 'sinon';

import unhandled from 'src/core/lib/middleware/unhandled';

import { MockRequest, MockResponse } from 'tests/support/unit/mocks';

registerSuite('lib/middleware/unhandled', function() {
  let handler: (request: any, response: any, next: any) => void;
  let response: MockResponse;
  let next: SinonSpy;
  let end: SinonSpy<[any, any?]>;

  return {
    beforeEach() {
      handler = unhandled();
      response = new MockResponse();
      next = spy();
      end = spy(response, 'end');
    },

    tests: {
      GET() {
        const request = new MockRequest('GET', '/foo/bar.js');
        handler(request, response, next);

        assert.isFalse(end.called, 'did not expect `end` to be called');
        assert.isTrue(next.calledOnce, 'expected `next` to be called');
        assert.instanceOf(next.args[0][0], HttpError);
        assert.strictEqual(next.args[0][0].statusCode, 404);
      },

      POST() {
        const request = new MockRequest('POST', '/foo/');
        handler(request, response, next);

        assert.isFalse(end.called, 'did not expect `end` to be called');
        assert.isTrue(next.calledOnce, 'expected `next` to be called');
        assert.instanceOf(next.args[0][0], HttpError);
        assert.strictEqual(next.args[0][0].statusCode, 501);
      }
    }
  };
});
