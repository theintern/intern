import RemoteSuite from 'src/core/lib/RemoteSuite';
import { ServerListener } from 'src/core/lib/Server';
import {
  createMockNodeExecutor,
  createMockRemoteAndSession,
  createMockServer,
  MockNode
} from 'tests/support/unit/mocks';
import { ObjectSuiteDescriptor } from 'src/core/lib/interfaces/object';

registerSuite('lib/RemoteSuite', {
  'id property'() {
    const remoteSuite = new RemoteSuite({
      name: 'foo',
      parent: <any>{
        name: 'bar'
      }
    });
    assert.strictEqual(
      remoteSuite.id,
      'bar',
      "RemoteSuite name shouldn't be part of id"
    );
  },

  '#run': (function() {
    let remoteSuite: RemoteSuite;
    let subscribers: ServerListener[];
    let executor: MockNode;

    return <ObjectSuiteDescriptor>{
      beforeEach() {
        subscribers = [];

        executor = createMockNodeExecutor({
          config: <any>{
            connectTimeout: 3456,
            heartbeatInterval: 123,
            serverUrl: 'http://foo.com/somewhere/else',
            basePath: '',
            internPath: ''
          },

          server: createMockServer({
            socketPort: 12345,

            subscribe(_sessionId: string, handler: ServerListener) {
              subscribers.push(handler);
              return {
                destroy() {}
              };
            }
          })
        });

        remoteSuite = new RemoteSuite({
          parent: <any>{ remote: createMockRemoteAndSession('foo') }
        });
        remoteSuite.executor = executor;
      },

      tests: {
        'connect timeout'() {
          remoteSuite.executor.config.connectTimeout = 10;
          return remoteSuite.run().then(
            () => {
              throw new Error('Suite should have failed');
            },
            error => {
              assert.match(error.message, /waiting for remote/);
            }
          );
        },

        'simple run'() {
          const dfd = this.async();
          remoteSuite.run().then(
            () => dfd.resolve(),
            error => dfd.reject(error)
          );

          assert.lengthOf(subscribers, 1);
          subscribers[0]('remoteStatus', 'initialized');

          setTimeout(
            dfd.rejectOnError(() => {
              assert.lengthOf(subscribers, 1);
              subscribers[0]('runEnd');
            })
          );
        },

        'root suite start and end'() {
          const dfd = this.async(undefined, 2);
          const promise = remoteSuite.run();
          const handler = subscribers[0];
          const events = executor.events;
          handler('remoteStatus', 'initialized');

          setTimeout(
            dfd.callback(() => {
              handler('suiteStart', {
                tests: ['foo', 'bar']
              });

              assert.deepEqual(<any[]>remoteSuite.tests, ['foo', 'bar']);
              assert.lengthOf(events, 1);
              assert.deepEqual(events[0], {
                name: 'suiteStart',
                data: remoteSuite
              });

              handler('suiteEnd', { tests: ['baz', 'bif'] });

              assert.deepEqual(<any[]>remoteSuite.tests, ['baz', 'bif']);
              assert.lengthOf(events, 1);

              handler('runEnd');
            })
          );

          promise.then(
            () => {
              dfd.resolve();
            },
            error => {
              dfd.reject(error);
            }
          );
        },

        'root suite error'() {
          const dfd = this.async(undefined, 2);
          const promise = remoteSuite.run();
          const handler = subscribers[0];
          const events = executor.events;
          handler('remoteStatus', 'initialized');

          setTimeout(
            dfd.callback(() => {
              handler('suiteStart', {
                tests: ['foo', 'bar']
              });

              assert.deepEqual(<any[]>remoteSuite.tests, ['foo', 'bar']);
              assert.lengthOf(events, 1);
              assert.deepEqual(events[0], {
                name: 'suiteStart',
                data: remoteSuite
              });

              const suiteError = new Error('foo');
              handler('suiteEnd', {
                tests: ['baz', 'bif'],
                error: suiteError
              });

              assert.deepEqual(<any[]>remoteSuite.tests, ['baz', 'bif']);
              assert.lengthOf(events, 1);
              assert.strictEqual<Error | undefined>(
                remoteSuite.error,
                suiteError
              );

              handler('runEnd');
            })
          );

          promise.then(
            () => {
              dfd.reject(new Error('Suite should not have passed'));
            },
            error => {
              if (error.message === 'foo') {
                dfd.resolve();
              } else {
                dfd.reject(new Error('Unexpected value of suite error'));
              }
            }
          );
        },

        'regular suite start and end'() {
          const dfd = this.async(undefined, 2);
          const promise = remoteSuite.run();
          const events = executor.events;
          const handler = subscribers[0];
          handler('remoteStatus', 'initialized');

          setTimeout(
            dfd.callback(() => {
              const suite = {
                hasParent: true,
                tests: ['foo', 'bar']
              };
              handler('suiteStart', suite);

              assert.lengthOf(remoteSuite.tests, 0);
              assert.lengthOf(events, 1);
              assert.deepEqual(events[0], {
                name: 'suiteStart',
                data: suite
              });

              handler('suiteEnd', suite);

              assert.lengthOf(events, 2);
              assert.deepEqual(events[1], {
                name: 'suiteEnd',
                data: suite
              });

              handler('runEnd');
            })
          );

          promise.then(
            () => {
              dfd.resolve();
            },
            error => {
              dfd.reject(error);
            }
          );
        },

        'consumed events'() {
          const dfd = this.async(undefined, 2);
          const promise = remoteSuite.run();
          const events = executor.events;
          const handler = subscribers[0];
          handler('remoteStatus', 'initialized');

          setTimeout(
            dfd.callback(() => {
              handler('beforeRun');
              assert.lengthOf(events, 0, 'beforeRun should have been consumed');

              handler('afterRun');
              assert.lengthOf(events, 0, 'afterRun should have been consumed');

              handler('runStart');
              assert.lengthOf(events, 0, 'runStart should have been consumed');

              handler('runEnd');
            })
          );

          promise.then(
            () => {
              dfd.resolve();
            },
            error => {
              dfd.reject(error);
            }
          );
        },

        'general error'() {
          const dfd = this.async(undefined, 2);
          const promise = remoteSuite.run();
          const events = executor.events;
          const handler = subscribers[0];
          const error = { message: 'foo' };
          handler('remoteStatus', 'initialized');

          setTimeout(
            dfd.callback(() => {
              handler('error', error);
              assert.lengthOf(
                events,
                0,
                'error event should have been consumed'
              );

              handler('runEnd');
            })
          );

          promise.then(
            () => {
              dfd.reject(new Error('Suite should not have passed'));
            },
            error => {
              if (error.message === 'foo') {
                dfd.resolve();
              } else {
                dfd.reject(new Error('Unexpected value of suite error'));
              }
            }
          );
        },

        'pass through events'() {
          const dfd = this.async(undefined, 2);
          const promise = remoteSuite.run();
          const events = executor.events;
          const handler = subscribers[0];
          handler('remoteStatus', 'initialized');

          setTimeout(
            dfd.callback(() => {
              handler('testEnd');
              assert.lengthOf(
                events,
                1,
                'testEnd event should have been emitted'
              );
              handler('runEnd');
            })
          );

          promise.then(
            () => {
              dfd.resolve();
            },
            error => {
              dfd.reject(error);
            }
          );
        }
      }
    };
  })()
});
