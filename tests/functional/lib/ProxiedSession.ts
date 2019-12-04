import { Task } from 'src/common';
import Server from 'src/webdriver/Server';

import ProxiedSession from 'src/core/lib/ProxiedSession';
import { Remote } from 'src/core/lib/executors/Node';

// Bring in Test and TestFunction from testing src rather than the src being
// tested
import Test, { TestFunction } from 'src/core/lib/Test';
import registerSuite, {
  ObjectSuiteDescriptor
} from 'src/core/lib/interfaces/object';
import { assert } from 'chai';

registerSuite('lib/ProxiedSession (functional)', () => {
  const serverUrl = 'https://example.invalid/';
  let session: ProxiedSession | null;
  let numGetCalls: number;
  let lastUrl: string | null;
  let mockCoverage = { isMockCoverage: true };

  function sleep(ms: number) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  function createProxiedSessionFromRemote(remote: Remote) {
    if (!remote.session) {
      throw new Error('Unsupported remote');
    }

    const server = <Server>{
      url: 'about:blank'
    };

    const session = new ProxiedSession(
      remote.session.sessionId + '-test',
      server,
      remote.session.capabilities
    );
    session.executor = <any>{
      emit: () => Promise.resolve(),
      log: () => Promise.resolve(),
      config: {}
    };

    session.baseUrl = serverUrl;

    session.serverGet = <any>function() {
      ++numGetCalls;
      return Task.resolve(lastUrl);
    };

    session.serverPost = <any>function(path: string, data: any) {
      if (path === 'url') {
        lastUrl = data.url;
      } else if (
        // Path will be `execute/sync` for W3C, or just `execute` for JWP
        /execute\/?/.test(path) &&
        data.args &&
        data.args[0] === '__testCoverage'
      ) {
        return Task.resolve(JSON.stringify(mockCoverage));
      }

      return Task.resolve();
    };

    session.server.deleteSession = function() {
      return Task.resolve();
    };

    return session;
  }

  function createCoverageTest(method: 'get' | 'quit'): TestFunction {
    return function(this: Test) {
      let coverage: any;
      const _session = session!;

      // Pre-initialize the browser URL; at least Safari 9 will fail to
      // get coverage if the browser location isn't an http/https URL.
      // This is reasonable since the typical case will be to get coverage
      // from a loaded page.
      let task = _session.get('http://example.invalid/');

      return task
        .then(() => {
          _session.coverageVariable = '__testCoverage';
          _session.executor.emit = <any>(
            function(eventName: string, value: any) {
              if (eventName === 'coverage') {
                coverage = value;
              }
              return Task.resolve();
            }
          );

          if (method === 'get') {
            return _session[method]('http://other.invalid/');
          } else {
            return _session[method]();
          }
        })
        .then(() => {
          assert.isDefined(coverage, 'Coverage event should have been emitted');
          assert.strictEqual(
            coverage.sessionId,
            _session.sessionId,
            'Correct session ID should be provided when broadcasting coverage data'
          );
          assert.deepEqual(
            coverage.coverage,
            mockCoverage,
            'Code coverage data retrieved from session should be broadcasted'
          );
        });
    };
  }

  return {
    before() {
      session = createProxiedSessionFromRemote(this.remote);
    },

    beforeEach() {
      return session!.setHeartbeatInterval(0).then(function() {
        numGetCalls = 0;
        lastUrl = null;
      });
    },

    after() {
      session = null;
    },

    tests: {
      '#get URL'() {
        return session!.get('http://example.invalid/').then(function() {
          assert.strictEqual(
            lastUrl,
            'http://example.invalid/',
            'Real URLs should be passed as-is'
          );
        });
      },

      '#get local file'() {
        return session!.get('test').then(function() {
          assert.strictEqual(
            lastUrl,
            serverUrl + 'test',
            'Local URLs should be converted according to defined proxy URL and base path length'
          );
        });
      },

      '#get coverage': createCoverageTest('get'),

      '#quit coverage': createCoverageTest('quit'),

      '#setHeartbeatInterval'() {
        let lastNumGetCalls: number;
        const _session = session!;

        // Set the heardbeat interval, then wait for about 5x that
        // interval -- should see about 5 get calls (a 'heartbeat' is a
        // getCurrentUrl call, which will call our session's mock 'get'
        // method)
        return _session
          .setHeartbeatInterval(50)
          .then(function() {
            return sleep(250);
          })
          .then(function() {
            // Should be about 5 calls in 250ms
            assert.closeTo(
              numGetCalls,
              5,
              1,
              'Heartbeats should occur on the given interval'
            );
            return _session.setHeartbeatInterval(0);
          })
          .then(function() {
            lastNumGetCalls = numGetCalls;
            return sleep(100);
          })
          .then(function() {
            assert.strictEqual(
              numGetCalls,
              lastNumGetCalls,
              'No more heartbeats should occur after being disabled'
            );
          });
      }
    }
  } as ObjectSuiteDescriptor;
});
