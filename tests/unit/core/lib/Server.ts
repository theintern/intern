import { STATUS_CODES } from 'http';
import createError from 'http-errors';
import sinon from 'sinon';

import _Server from 'src/core/lib/Server';
import {
  createMockNodeExecutor,
  MockExecutor,
  MockRequest,
  MockResponse,
  EventHandler
} from 'tests/support/unit/mocks';
import { mockFs, mockPath } from 'tests/support/unit/nodeMocks';

const mockRequire = <mocking.MockRequire>intern.getPlugin('mockRequire');

let Server: typeof _Server;

class MockSocket extends EventHandler {
  destroyed: boolean;

  constructor() {
    super();
    this.destroyed = false;
  }

  destroy() {
    this.destroyed = true;
  }

  setNoDelay() {}

  send() {}
}

class MockServer extends EventHandler {
  closed: boolean;

  constructor() {
    super();
    this.closed = false;
  }

  close(callback?: Function) {
    this.closed = true;
    if (callback) {
      callback();
    }
    if (this.handlers.close) {
      this.handlers.close.forEach(handler => handler());
    }
  }
}

function assertPropertyLength(
  obj: { [key: string]: any },
  name: string,
  length: number,
  message?: string
) {
  assert.property(obj, name, message);
  assert.lengthOf(obj[name], length, message);
}

let removeMocks: () => void;

registerSuite('lib/Server', function() {
  // These classes below access closured data, so they're defined in here

  class MockWebSocketServer extends MockServer {
    constructor() {
      super();
      webSocketServers.push(this);
    }
  }

  class MockHttpServer extends MockServer {
    port: number | undefined;
    responder: (request: any, response: any) => void;

    constructor(responder: (request: any, response: any) => void) {
      super();
      this.responder = responder;
      httpServers.push(this);
    }

    listen(port: number, callback: () => void) {
      this.port = port;
      setTimeout(callback);
      return this;
    }
  }

  let httpServers: MockHttpServer[];
  let webSocketServers: MockWebSocketServer[];

  const mockHttp = {
    STATUS_CODES,

    createServer(handler: () => void) {
      return new MockHttpServer(handler);
    }
  };

  const mockWebSocket = {
    Server: MockWebSocketServer
  };

  const sandbox = sinon.createSandbox();

  function passthroughMiddleware(_: any, __: any, callback: () => void) {
    callback();
  }

  const jsonHandler = sandbox.spy(passthroughMiddleware);
  const urlEncodedHandler = sandbox.spy(passthroughMiddleware);
  const mockBodyParser = {
    json: sandbox.spy((..._args: any[]) => jsonHandler),
    urlencoded: sandbox.spy((..._args: any[]) => urlEncodedHandler)
  };

  let fs = mockFs();
  let path = mockPath();

  const internStaticHandler = sandbox.stub();
  const baseStaticHandler = sandbox.stub();

  let server: _Server;
  let executor: MockExecutor;

  const mockServeStatic = sandbox.spy((path: string) => {
    if (path === executor.config.internPath) {
      return internStaticHandler;
    } else if (path === server.basePath) {
      return baseStaticHandler;
    }
  });

  function mockMiddleware(error = false) {
    const handler = sandbox.stub();
    const wrapper = error
      ? function(this: any, req: any, res: any, next: any, err: any) {
          return handler.call(this, req, res, next, err);
          // tslint:disable-next-line:indent
        }
      : handler;
    const middleware = sandbox.spy(() => wrapper);

    return { middleware, handler };
  }

  const {
    middleware: instrument,
    handler: instrumentHandler
  } = mockMiddleware();
  const { middleware: unhandled, handler: unhandledHandler } = mockMiddleware();
  const { middleware: post, handler: postHandler } = mockMiddleware();
  const { middleware: finalError, handler: finalErrorHandler } = mockMiddleware(
    true
  );

  return {
    before() {
      return mockRequire(require, 'src/core/lib/Server', {
        fs,
        path,
        http: mockHttp,
        ws: mockWebSocket,
        'src/core/lib/middleware/instrument': instrument,
        'src/core/lib/middleware/post': post,
        'src/core/lib/middleware/unhandled': unhandled,
        'src/core/lib/middleware/finalError': finalError,
        'serve-static/index': mockServeStatic,
        express: null,
        'express/lib/express': null,
        'express/lib/application': null,
        'express/lib/request': Object.create(MockRequest.prototype),
        'express/lib/response': Object.create(MockResponse.prototype),
        'body-parser': mockBodyParser
      }).then(resource => {
        removeMocks = resource.remove;
        Server = resource.module.default;
      });
    },

    after() {
      removeMocks();
      sandbox.restore();
    },

    beforeEach() {
      fs.__fileData = {};
      httpServers = [];
      webSocketServers = [];
      executor = createMockNodeExecutor();
      server = new Server({ executor: executor as any });
    },

    afterEach() {
      sandbox.reset();
    },

    tests: {
      '#start': {
        init() {
          server.port = 12345;
          return server.start().then(() => {
            assert.lengthOf(
              httpServers,
              1,
              'unexpected number of HTTP servers were created'
            );
            assert.lengthOf(
              webSocketServers,
              1,
              'unexpected number of websocket servers were created'
            );

            const wsServer = webSocketServers[0];
            assertPropertyLength(
              wsServer.handlers,
              'error',
              1,
              'unexpected number of websocket error handlers'
            );
            assertPropertyLength(
              wsServer.handlers,
              'connection',
              1,
              'unexpected number of websocket connection handlers'
            );

            const httpServer = httpServers[0];
            assertPropertyLength(
              httpServer.handlers,
              'connection',
              1,
              'unexpected number of http connection handlers'
            );
            assert.strictEqual(
              httpServer.port,
              12345,
              'HTTP server not listening on expected port'
            );

            // middleware tests
            assert.isTrue(mockBodyParser.json.calledOnce);
            assert.isTrue(mockBodyParser.urlencoded.calledOnce);
            assert.deepEqual(mockBodyParser.urlencoded.firstCall.args[0], {
              extended: true
            });
            assert.isTrue(mockServeStatic.calledTwice);
            assert.deepEqual(mockServeStatic.firstCall.args, [
              server.executor.config.internPath,
              { fallthrough: false }
            ]);
            assert.deepEqual(mockServeStatic.secondCall.args, [
              server.basePath
            ]);
            assert.isTrue(instrument.calledOnce);
            assert.isTrue(post.calledOnce);
            assert.isTrue(unhandled.calledOnce);
            assert.isTrue(finalError.calledOnce);
          });
        },

        'http connection': {
          'close with live sockets'() {
            return server.start().then(() => {
              const httpServer = httpServers[0];
              const handler = httpServer.handlers['connection'][0];
              const socket = new MockSocket();
              handler(socket);
              assert.isFalse(
                socket.destroyed,
                'socket should not have been destroyed'
              );
              assertPropertyLength(
                socket.handlers,
                'close',
                1,
                'unexpected number of socket close handlers'
              );

              httpServer.close();
              assert.isTrue(
                socket.destroyed,
                'socket should have been destroyed'
              );
            });
          },

          'close sockets'() {
            return server.start().then(() => {
              const httpServer = httpServers[0];
              const handler = httpServer.handlers.connection[0];
              const socket = new MockSocket();
              handler(socket);

              // Check the socket handler after closing the HTTP
              // server, because calling it before would prevent
              // Server from trying to destroy it.
              assert.doesNotThrow(() => {
                socket.handlers.close[0]();
              }, 'closing a socket handler should not have thrown');

              httpServer.close();
              assert.isFalse(
                socket.destroyed,
                'socket should not have been destroyed'
              );
            });
          }
        },

        'websocket connection': {
          connect() {
            return server.start().then(() => {
              const wsServer = webSocketServers[0];
              const handler = wsServer.handlers.connection[0];
              const socket = new MockSocket();
              handler(socket);

              assertPropertyLength(
                socket.handlers,
                'message',
                1,
                'unexpected number of socket message handlers'
              );
              assertPropertyLength(
                socket.handlers,
                'error',
                1,
                'unexpected number of socket error handlers'
              );
            });
          },

          error() {
            return server.start().then(() => {
              const wsServer = webSocketServers[0];
              const handler = wsServer.handlers.error[0];
              const error = new Error('foo');
              handler(error);

              assert.lengthOf(
                executor.events,
                1,
                'unexpected number of executor events were emitted'
              );
              assert.deepEqual(
                executor.events[0],
                { name: 'error', data: error },
                'unexpected event'
              );
            });
          },

          'socket error'() {
            return server.start().then(() => {
              const wsServer = webSocketServers[0];
              const handler = wsServer.handlers.connection[0];
              const socket = new MockSocket();
              handler(socket);

              const error = new Error('foo');
              socket.handlers.error[0](error);

              assert.lengthOf(
                executor.events,
                1,
                'unexpected number of executor events were emitted'
              );
              assert.deepEqual(
                executor.events[0],
                { name: 'error', data: error },
                'unexpected event'
              );
            });
          }
        },

        'http request handling': {
          'decorated request and response'() {
            server.basePath = '/';
            return server.start().then(() => {
              const responder = httpServers[0].responder;
              const request = new MockRequest('GET', '/foo/thing.js');
              const response = new MockResponse();

              responder(request, response);

              assert.isOk(request.intern);
              assert.isOk(response.intern);
              assert.strictEqual(request.intern, response.intern);
              assert.strictEqual(
                request.intern!.executor,
                server.executor as any
              );
              assert.strictEqual(request.intern!.basePath, server.basePath);
            });
          },
          'missing file'() {
            server.basePath = '/';
            return server.start().then(() => {
              const responder = httpServers[0].responder;
              const request = new MockRequest('GET', '/foo/thing.js');
              const response = new MockResponse();

              instrumentHandler.callsArgWith(2, createError(404));

              responder(request, response);

              assert.isTrue(jsonHandler.calledOnce);
              assert.isTrue(urlEncodedHandler.calledOnce);
              assert.isFalse(internStaticHandler.called);
              assert.isTrue(instrumentHandler.calledOnce);
              assert.isFalse(baseStaticHandler.called);
              assert.isFalse(postHandler.called);
              assert.isFalse(unhandledHandler.called);
              assert.isTrue(finalErrorHandler.called);
            });
          },

          'intern resource'() {
            executor.config.internPath = '/modules/intern/';
            return server.start().then(() => {
              internStaticHandler.callsFake((_request: any, response: any) => {
                response.data = 'what a fun time';
              });
              const responder = httpServers[0].responder;
              const request = new MockRequest('GET', '/__intern/bar/thing.js');
              const response = new MockResponse();

              responder(request, response);

              assert.isTrue(internStaticHandler.calledOnce);
              assert.equal(response.data, 'what a fun time');
              assert.isFalse(instrumentHandler.called);
              assert.isFalse(baseStaticHandler.called);
              assert.isFalse(postHandler.called);
              assert.isFalse(unhandledHandler.called);
              assert.isFalse(finalErrorHandler.called);
            });
          },

          'index URL'() {
            server.basePath = '/base';
            return server.start().then(() => {
              instrumentHandler.callsArg(2);
              baseStaticHandler.callsFake((_request: any, response: any) => {
                response.data = 'what a fun time';
              });

              const responder = httpServers[0].responder;
              const request = new MockRequest('GET', '/foo');
              const response = new MockResponse();

              responder(request, response);

              assert.isTrue(instrumentHandler.called);
              assert.isTrue(baseStaticHandler.calledOnce);
              assert.equal(response.data, 'what a fun time');
              assert.isFalse(internStaticHandler.called);
              assert.isFalse(postHandler.called);
              assert.isFalse(unhandledHandler.called);
              assert.isFalse(finalErrorHandler.called);
            });
          },

          POST() {
            return server.start().then(() => {
              instrumentHandler.callsArg(2);
              baseStaticHandler.callsArg(2);
              postHandler.callsFake((_request: any, response: any) => {
                response.data = 'what a fun time';
              });

              const responder = httpServers[0].responder;
              const request = new MockRequest('POST', '/foo');
              const response = new MockResponse();

              responder(request, response);

              assert.isTrue(instrumentHandler.calledOnce);
              assert.isTrue(baseStaticHandler.calledOnce);
              assert.isTrue(postHandler.calledOnce);
              assert.equal(response.data, 'what a fun time');
              assert.isFalse(internStaticHandler.called);
              assert.isFalse(unhandledHandler.called);
              assert.isFalse(finalErrorHandler.called);
            });
          },

          'unhandled request'() {
            instrumentHandler.callsArg(2);
            baseStaticHandler.callsArg(2);
            postHandler.callsArg(2);
            unhandledHandler.callsArgWith(2, createError(501));

            return server.start().then(() => {
              const responder = httpServers[0].responder;
              const request = new MockRequest(<any>'DELETE', '/foo');
              const response = new MockResponse();

              responder(request, response);

              assert.isTrue(instrumentHandler.calledOnce);
              assert.isTrue(baseStaticHandler.calledOnce);
              assert.isTrue(postHandler.calledOnce);
              assert.strictEqual(response.data, '');
              assert.isFalse(internStaticHandler.called);
              assert.isTrue(unhandledHandler.calledOnce);
              assert.isTrue(finalErrorHandler.calledOnce);
              assert.strictEqual(
                finalErrorHandler.firstCall.args[0].statusCode,
                501
              );
            });
          }
        },

        'message handling': {
          beforeEach() {
            instrumentHandler.callsArg(2);
            baseStaticHandler.callsArg(2);
          },

          tests: {
            'successful handler'() {
              return server.start().then(() => {
                const listener = sinon.stub().resolves();
                server.subscribe('foo', listener);

                const responder = httpServers[0].responder;
                const request = new MockRequest(<any>'DELETE', '/foo');
                const response = new MockResponse();

                responder(request, response);

                return postHandler.firstCall.args[0].intern
                  .handleMessage({
                    sessionId: 'foo',
                    id: 1,
                    name: 'foo',
                    data: 'bar'
                  })
                  .then(() => {
                    assert.isTrue(listener.calledOnce);
                  });
              });
            },

            'message handler rejection'() {
              return server.start().then(() => {
                const listener = sinon.stub().rejects(new Error('bad message'));
                server.subscribe('foo', listener);

                const responder = httpServers[0].responder;
                const request = new MockRequest(<any>'DELETE', '/foo');
                const response = new MockResponse();

                responder(request, response);

                return postHandler.firstCall.args[0].intern
                  .handleMessage({
                    sessionId: 'foo',
                    id: 1,
                    name: 'foo',
                    data: 'bar'
                  })
                  .then(() => assert(false, 'should not have resolved'))
                  .catch(() => {
                    assert.isTrue(listener.calledOnce);
                  });
              });
            }
          }
        }
      },

      '#stop': {
        running() {
          return server.start().then(() => {
            return server.stop().then(() => {
              assert.isTrue(
                webSocketServers[0].closed,
                'websocket server should have been closed'
              );
              assert.isTrue(
                httpServers[0].closed,
                'http server should have been closed'
              );
            });
          });
        },

        'already stopped'() {
          // Check that stop doesn't reject
          return server.stop();
        }
      },

      '#subscribe': {
        'before start'() {
          // Server doesn't initialize its sessions object until it's
          // started, so subscribing before start will fail
          assert.throws(() => {
            server.subscribe('foo', () => {});
          }, /Cannot read property/);
        },

        'publish message'() {
          return server.start().then(() => {
            const messages: { name: string; data: any }[] = [];
            const listener = (name: string, data: any) => {
              messages.push({ name, data });
            };
            const handle = server.subscribe('foo', listener);
            assert.isDefined(handle, 'subscribe should return a handle');

            const wsServer = webSocketServers[0];
            const handler = wsServer.handlers.connection[0];
            const socket = new MockSocket();
            handler(socket);

            socket.handlers.message[0](
              JSON.stringify({
                sessionId: 'foo',
                id: 1,
                name: 'foo'
              })
            );

            assert.lengthOf(
              messages,
              1,
              'expected 1 message to have been published'
            );

            handle.destroy();

            // Calling destroy multiple times should be fine
            handle.destroy();
          });
        }
      }
    }
  };
});
