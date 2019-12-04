import * as sinon from 'sinon';

import post from 'src/core/lib/middleware/post';
import {
  createMockNodeExecutor,
  createMockServer,
  MockRequest,
  MockResponse,
  createMockServerContext
} from 'tests/support/unit/mocks';

registerSuite('lib/middleware/post', function() {
  let handler: (request: any, response: any, next: any) => void;
  let request: MockRequest;
  let response: MockResponse;
  let next: sinon.SinonSpy;
  let end: sinon.SinonSpy<[any, any?]>;
  let handleMessage: sinon.SinonStub;

  return {
    beforeEach() {
      const server = createMockServer({
        executor: createMockNodeExecutor()
      });
      handleMessage = sinon.stub();
      const context = createMockServerContext(server, handleMessage);
      handler = post(context);
      request = new MockRequest('POST', '/');
      response = new MockResponse();
      next = sinon.spy();
      end = sinon.spy(response, 'end');
    },

    tests: {
      'skipped for non-POST'() {
        request.method = 'GET';
        handler(request, response, next);

        assert.isTrue(next.calledOnce);
        assert.isFalse(end.called);
      },

      'single message'() {
        request.body = JSON.stringify({
          sessionId: 'foo',
          id: 1,
          name: 'foo',
          data: 'bar'
        });
        handleMessage.resolves();

        handler(request, response, next);

        assert.isFalse(next.called);

        return Promise.all(handleMessage.returnValues).then(() => {
          assert.equal(response.data, '', 'expected POST response to be empty');
          assert.strictEqual(
            response.statusCode,
            204,
            'expected success status for good message'
          );

          assert.isTrue(handleMessage.calledOnce);
          assert.deepEqual(handleMessage.firstCall.args[0], {
            sessionId: 'foo',
            id: 1,
            name: 'foo',
            data: 'bar'
          });
        });
      },

      'array of messages'() {
        request.body = [
          JSON.stringify({
            sessionId: 'foo',
            id: 1,
            name: 'foo',
            data: 'bar'
          }),
          JSON.stringify({
            sessionId: 'foo',
            id: 2,
            name: 'baz',
            data: 'blah'
          }),
          JSON.stringify({
            sessionId: 'bar',
            id: 1,
            name: 'ham',
            data: 'spam'
          })
        ];
        handleMessage.resolves();

        handler(request, response, next);

        assert.isFalse(next.called);

        return Promise.all(handleMessage.returnValues).then(() => {
          assert.equal(response.data, '', 'expected POST response to be empty');
          assert.strictEqual(
            response.statusCode,
            204,
            'expected success status for good message'
          );
          assert.isTrue(handleMessage.calledThrice);

          assert.deepEqual(handleMessage.args, [
            [
              {
                sessionId: 'foo',
                id: 1,
                name: 'foo',
                data: 'bar'
              }
            ],
            [
              {
                sessionId: 'foo',
                id: 2,
                name: 'baz',
                data: 'blah'
              }
            ],
            [
              {
                sessionId: 'bar',
                id: 1,
                name: 'ham',
                data: 'spam'
              }
            ]
          ]);
        });
      },

      'bad message'() {
        request.body = '[[[';

        handler(request, response, next);

        assert.isFalse(next.called);
        assert.equal(response.data, '', 'expected POST response to be empty');
        assert.strictEqual(
          response.statusCode,
          500,
          'expected error status for bad message'
        );
      },

      'message handler rejection'() {
        request.body = JSON.stringify({
          sessionId: 'foo',
          id: 1,
          name: 'foo',
          data: 'bar'
        });
        handleMessage.rejects(new Error('bad message'));

        handler(request, response, next);

        return Promise.all(handleMessage.returnValues)
          .then(() => assert(false, 'should not have resolved'))
          .catch(() => {
            assert.equal(
              response.data,
              '',
              'expected POST response to be empty'
            );
            assert.strictEqual(
              response.statusCode,
              500,
              'expected error status for bad message'
            );
          });
      }
    }
  };
});
