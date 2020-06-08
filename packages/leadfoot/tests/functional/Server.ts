import * as util from './support/util';
import { Task } from '@theintern/common';
import Server from '../../src/Server';
import Session from '../../src/Session';
import * as urlUtil from 'url';
import { Capabilities } from '../../src/interfaces';
import Test from 'intern/lib/Test';
import { ObjectSuiteDescriptor } from 'intern/lib/interfaces/object';

registerSuite('Server', () => {
  let server: Server;

  return {
    before() {
      const remote = this.remote;
      server = util.createServerFromRemote(remote);
    },

    tests: {
      'object constructor with string'() {
        const server = new Server('https://test:1234/w/d///');
        assert.strictEqual(server.url, 'https://test:1234/w/d/');
      },

      'object constructor with object'() {
        const server = new Server({
          protocol: 'https',
          hostname: 'test',
          port: '1234',
          pathname: '/w/d'
        });
        assert.strictEqual(server.url, 'https://test:1234/w/d/');
      },

      'object constructor with password auth'() {
        const server = new Server({
          protocol: 'https',
          hostname: 'test',
          port: '1234',
          pathname: '/w/d/',
          username: 'user',
          password: 'pass'
        });
        assert.strictEqual(server.url, 'https://user:pass@test:1234/w/d/');
      },

      'object constructor with access key auth'() {
        const server = new Server({
          protocol: 'https',
          hostname: 'test',
          port: '1234',
          pathname: '/w/d/',
          username: 'user',
          accessKey: 'pass'
        });
        assert.strictEqual(server.url, 'https://user:pass@test:1234/w/d/');
      },

      'error handling'() {
        return server.get('invalidCommand').then(
          function() {
            throw new Error(
              'Request to invalid command should not be successful'
            );
          },
          function(error: Error) {
            assert.strictEqual(
              error.name,
              'UnknownCommand',
              'Unknown command should throw error'
            );
          }
        );
      },

      'error output security'() {
        const url = urlUtil.parse(server.url);
        if (!url.auth) {
          url.auth = 'user:pass';
        }

        const testServer = new Server(url);

        return testServer.get('invalidCommand').then(
          function() {
            throw new Error(
              'Request to invalid command should not be successful'
            );
          },
          function(error: Error) {
            assert.notInclude(
              error.message,
              url.auth,
              'HTTP auth credentials should not be displayed in errors'
            );

            url.auth = '(redacted)';
            assert.include(
              error.message,
              urlUtil.format(url),
              'Redacted URL should be displayed in error'
            );
          }
        );
      },

      '#getStatus'() {
        return server.getStatus().then(function(result) {
          assert.isObject(
            result,
            'Server should provide an object with details about the server'
          );
        });
      },

      '#getSessions'(this: Test) {
        const remoteCapabilities = <Capabilities>(
          this.remote.session.capabilities
        );
        if (remoteCapabilities.brokenSessionList) {
          this.skip('Server will not provide session lists');
        }

        const currentSessionId = this.remote.session
          ? this.remote.session.sessionId
          : (<any>this.remote).sessionId;
        return server
          .getSessions()
          .then(function(result: any[]) {
            assert.isArray(result);
            assert.operator(result.length, '>=', 1);
            assert.isTrue(
              result.some(function(session: any) {
                return currentSessionId === session.id;
              })
            );
          })
          .catch(function(error) {
            // Some servers do not support retrieving sessions; this is
            // OK, another server test will verify that this code is
            // working
            if (error.name !== 'UnknownCommand') {
              throw error;
            }
          });
      },

      '#getSessionCapabilities'(this: Test) {
        const desiredCapabilities = this.remote.session.capabilities;
        if (
          (<Capabilities>desiredCapabilities).supportsSessionCommands === false
        ) {
          this.skip('Server does not support session commands');
        }

        const sessionId = this.remote.session.sessionId;
        const platforms: { [key: string]: string[] } = {
          WINDOWS: ['Windows NT', 'WINDOWS', 'WIN8_1', 'XP']
        };

        return server
          .getSessionCapabilities(sessionId)
          .then(function(capabilities: Capabilities) {
            assert.isObject(capabilities);
            assert.strictEqual(
              capabilities.browserName,
              desiredCapabilities.browserName
            );
            assert.strictEqual(
              capabilities.version,
              desiredCapabilities.version
            );
            assert.include(
              platforms[desiredCapabilities.platform!] || [
                desiredCapabilities.platform
              ],
              capabilities.platform
            );
          });
      },

      '#createSession & .sessionConstructor': (function() {
        class CustomSession {
          sessionId: string;
          server: Server;
          capabilities: Capabilities;

          constructor(
            sessionId: string,
            server: Server,
            capabilities: Capabilities
          ) {
            this.sessionId = sessionId;
            this.server = server;
            this.capabilities = capabilities;
          }
        }

        let oldCtor: any;
        let oldPost: any;
        let mockCapabilities = {
          isMockCapabilities: true
        };
        let desiredCapabilities: Capabilities = { fooCapability: true };
        let requiredCapabilities: Capabilities = {};

        return {
          before() {
            oldCtor = server.sessionConstructor;
            oldPost = server.post;
            server.sessionConstructor = <any>CustomSession;
            server.fixSessionCapabilities = false;
            server.post = (method: string, data: any) => {
              assert.strictEqual(method, 'session');
              assert.strictEqual(data.desiredCapabilities, desiredCapabilities);
              assert.strictEqual(
                data.requiredCapabilities,
                requiredCapabilities
              );

              return Task.resolve<any>({
                sessionId: 'test',
                value: mockCapabilities
              });
            };
          },

          after() {
            server.sessionConstructor = oldCtor;
            server.fixSessionCapabilities = true;
            server.post = oldPost;
          },

          tests: {
            test() {
              return server
                .createSession(desiredCapabilities, requiredCapabilities)
                .then(function(session: Session) {
                  assert.instanceOf(session, CustomSession);
                  assert.strictEqual(session.sessionId, 'test');
                  assert.strictEqual(session.server, server);
                  assert.deepEqual(session.capabilities, {
                    ...mockCapabilities,
                    ...desiredCapabilities
                  });
                });
            }
          }
        };
      })(),

      '#deleteSession'() {
        const oldDelete = server.delete;
        server.delete = <any>(
          function(command: string, _data: any, pathData: string[]) {
            assert.strictEqual(command, 'session/$0');
            assert.deepEqual(pathData, ['test']);
            return Task.resolve();
          }
        );

        try {
          server.deleteSession('test');
        } finally {
          server.delete = oldDelete;
        }
      }
    }
  } as ObjectSuiteDescriptor;
});
