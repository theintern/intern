import { mockImport } from '@theintern-dev/test-util';
import sinon from 'sinon';

import _instrument from 'src/lib/middleware/instrument';
import Server from 'src/lib/Server';
import {
  createMockNodeExecutor,
  createMockServer,
  MockRequest,
  MockResponse,
  createMockServerContext
} from 'tests/support/unit/mocks';
import {
  createMockFs,
  createMockPath,
  MockStats
} from 'tests/support/unit/nodeMocks';
import { normalize } from 'path';
import { PathLike, Stats, stat } from 'fs';

const testPath = normalize('/base/foo/thing.js');

registerSuite('lib/middleware/instrument', function () {
  let instrument: typeof _instrument;

  let server: Server;
  let shouldInstrumentFile: sinon.SinonStub<[string]>;
  let instrumentCode: sinon.SinonStub<[string, string, boolean?]>;
  let handler: (request: any, response: any, next: any) => any;
  let request: MockRequest;
  let response: MockResponse;
  let next: sinon.SinonSpy;

  const mockFs = createMockFs();
  const mockPath = createMockPath();

  const sandbox = sinon.createSandbox();

  return {
    async before() {
      ({ default: instrument } = await mockImport(
        () => import('src/lib/middleware/instrument'),
        replace => {
          replace(() => import('fs')).with(mockFs);
          replace(() => import('path')).with(mockPath);
        }
      ));
    },

    beforeEach() {
      mockFs.__fileData = {
        [testPath]: {
          type: 'file',
          data: 'what a fun time'
        }
      };
      server = createMockServer({
        basePath: '/base',
        executor: createMockNodeExecutor()
      });
      shouldInstrumentFile = sandbox.stub(
        server.executor,
        'shouldInstrumentFile'
      );
      instrumentCode = sandbox.stub(server.executor, 'instrumentCode');
      const context = createMockServerContext(server);
      handler = instrument(context);
      request = new MockRequest('GET', '/foo/thing.js');
      response = new MockResponse();
      next = sinon.spy();
    },

    afterEach() {
      sandbox.restore();
    },

    tests: {
      'instrumented file': {
        beforeEach() {
          shouldInstrumentFile.returns(true);
          instrumentCode.callsFake((code: string) => code);
        },

        tests: {
          successful() {
            handler(request, response, next);

            assert.isFalse(next.called);
            assert.equal(response.data, 'what a fun time');
            assert.strictEqual(
              response.statusCode,
              200,
              'expected success status for good file'
            );
          },

          'caches code'() {
            handler(request, response, next);
            handler(request, response, next);

            assert.isFalse(next.calledTwice);
            assert.isTrue(instrumentCode.calledOnce);
          },

          'non-existent'() {
            request.url = '/bar/thing.js';
            handler(request, response, next);

            assert.isTrue(next.calledOnce);
            assert.instanceOf(next.firstCall.args[0], Error);
            assert.strictEqual(next.firstCall.args[0].status, 404);
          },

          directory() {
            mockFs.__fileData[testPath]!.type = 'directory';

            handler(request, response, next);

            assert.isTrue(next.calledOnce);
            assert.instanceOf(next.firstCall.args[0], Error);
            assert.strictEqual(next.firstCall.args[0].status, 404);
          },

          'read error'() {
            sandbox.stub(mockFs, 'stat').callsFake(((
              path: PathLike,
              callback: (
                err: NodeJS.ErrnoException | null,
                stats: Stats
              ) => void
            ) => {
              const data = mockFs.__fileData[testPath];
              mockFs.__fileData[testPath] = undefined;
              callback(
                null,
                (new MockStats(path, data!.type) as unknown) as Stats
              );
            }) as typeof stat);
            handler(request, response, next);

            assert.isTrue(next.calledOnce);
            assert.instanceOf(next.firstCall.args[0], Error);
            assert.strictEqual(next.firstCall.args[0].status, 404);
          },

          'server stopped': {
            tests: {
              stat() {
                (server as any).stopped = true;
                const end = sinon.spy(response, 'end');
                handler(request, response, next);

                assert.isFalse(next.called);
                assert.isFalse(end.called);
              },

              readFile() {
                const { readFile } = mockFs;
                const end = sinon.spy(response, 'end');

                sandbox.stub(mockFs, 'readFile').callsFake(((
                  path: string,
                  options: string,
                  callback: any
                ) => {
                  (server as any).stopped = true;
                  readFile(path, options, callback);
                }) as typeof mockFs.readFile);
                handler(request, response, next);

                assert.isFalse(next.called);
                assert.isFalse(end.called);
              }
            },

            after() {
              if (server) {
                (<any>server).stopped = false;
              }
            }
          },

          HEAD() {
            request.method = 'HEAD';
            const end = sinon.spy(response, 'end');

            handler(request, response, next);

            assert.isFalse(next.called);
            assert.isTrue(end.calledOnce);
            assert.strictEqual(end.firstCall.args[0], '');
          }
        }
      },

      'non-instrumented file'() {
        shouldInstrumentFile.returns(false);
        const end = sinon.spy(response, 'end');

        handler(request, response, next);

        assert.isTrue(next.calledOnce, 'next should have been called');
        assert.isFalse(end.called, 'end should not have been called');
        assert.lengthOf(
          next.firstCall.args,
          0,
          'next should have been called with no arguments'
        );
      },

      POST() {
        request.method = 'POST';
        const end = sinon.spy(response, 'end');

        handler(request, response, next);

        assert.isTrue(next.calledOnce, 'next should have been called');
        assert.isFalse(end.called, 'end should not have been called');
        assert.lengthOf(
          next.firstCall.args,
          0,
          'next should have been called with no arguments'
        );
      }
    }
  };
});
