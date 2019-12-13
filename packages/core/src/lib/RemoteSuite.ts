import { parse } from 'url';
import { relative } from 'path';
import { stringify as stringifyQuery } from 'querystring';
import { Handle, Task, CancellablePromise } from '@theintern/common';

import Suite, { SuiteOptions } from './Suite';
import { InternError } from './types';
import Node, { NodeEvents } from './executors/Node';
import { Config } from './common/config';
import Browser from './executors/Browser';
import { stringify } from './common/util';
import Deferred from './Deferred';

// This is used for the `execute` config block
declare const intern: Browser;

/**
 * RemoteSuite is a class that acts as a local server for one or more unit test
 * suites being run in a remote browser.
 */
export default class RemoteSuite extends Suite {
  executor!: Node;

  constructor(options?: Partial<SuiteOptions>) {
    options = options || {};
    if (options.name == null) {
      options.name = 'remote unit tests';
    }

    super(<SuiteOptions>options);

    if (this.timeout == null) {
      this.timeout = Infinity;
    }
  }

  /**
   * Override Suite#id to exclude the RemoteSuite's name from the generated ID
   * since the RemoteSuite is just a proxy for a remote suite.
   */
  get id() {
    let name: string[] = [];
    let suite: Suite = this.parent!;

    do {
      suite.name != null && name.unshift(suite.name);
    } while ((suite = suite.parent!));

    return name.join(' - ');
  }

  /**
   * Run a suite in a remote browser.
   */
  run(): CancellablePromise<any> {
    const remote = this.remote;
    const sessionId = remote.session.sessionId;
    const server = this.executor.server!;
    let listenerHandle: Handle;
    let connectTimer: NodeJS.Timer;

    return new Task(
      (resolve, reject) => {
        const handleError = (error: InternError) => {
          this.error = error;
          reject(error);
        };

        const config = this.executor.config;

        // This is a deferred that will resolve when the remote sends
        // back a 'remoteConfigured' message
        const pendingConnection = new Deferred<void>();

        // If the remote takes to long to connect, reject the connection
        // promise
        const connectTimeout = config.connectTimeout;
        connectTimer = global.setTimeout(() => {
          const error = new Error('Timed out waiting for remote to connect');
          error.name = 'TimeoutError';
          pendingConnection.reject(error);
        }, connectTimeout);

        // Subscribe to messages received by the server for a particular
        // remote session ID.
        listenerHandle = server.subscribe(
          sessionId,
          (eventName: string, data: any) => {
            const name = <keyof RemoteEvents>eventName;
            let suite: Suite;

            switch (name) {
              case 'remoteStatus':
                if (data === 'initialized') {
                  clearTimeout(connectTimer);
                  pendingConnection.resolve();
                }
                break;

              case 'suiteStart':
                suite = data;
                if (!suite.hasParent) {
                  // This suite from the browser is a root
                  // suite; add its tests to the local suite
                  this.tests.push(...suite.tests);

                  // Tell the executor that the local suite
                  // has started
                  return this.executor.emit('suiteStart', this);
                } else {
                  // If suite from the browser isn't a root
                  // (i.e., it's a nested suite), just forward
                  // the start event
                  return this.executor.emit(name, data);
                }

              case 'suiteEnd':
                suite = data;
                this.skipped = suite.skipped;

                if (!suite.hasParent) {
                  // When the remote root suite has finished,
                  // replace the local test objects with the
                  // incoming test data since it will include
                  // final results.
                  suite.tests.forEach((test, index) => {
                    this.tests[index] = test;
                  });

                  if (suite.error) {
                    handleError(suite.error);
                  }
                } else {
                  // If suite from the browser isn't a root,
                  // just forward the end event
                  return this.executor.emit(name, data);
                }
                break;

              case 'beforeRun':
              case 'afterRun':
              case 'runStart':
                // Consume these events -- they shouldn't be
                // forwarded to any local listeners
                break;

              case 'runEnd':
                // Consume this event, and do some
                // post-processing
                let promise = remote.setHeartbeatInterval(0);
                if (this.executor.hasCoveredFiles) {
                  // get about:blank to always collect code
                  // coverage data from the page in case it is
                  // navigated away later by some other
                  // process; this happens during self-testing
                  // when the Leadfoot library takes over
                  promise = promise.get('about:blank');
                }
                return promise.then(resolve, reject);

              case 'error':
                // Ignore summary suite error messages
                if (!/One or more suite errors/.test(data.message)) {
                  handleError(data);
                }
                break;

              default:
                return this.executor.emit(name, data);
            }
          }
        );

        const serverUrl = parse(config.serverUrl);

        // Intern runs unit tests on the remote Selenium server by
        // navigating to the client runner HTML page. No real commands
        // are issued after the call to remote.get() below until all
        // unit tests are complete, so we need to make sure that we
        // periodically send no-ops through the channel to ensure the
        // remote server does not treat the session as having timed out
        const timeout = config.heartbeatInterval!;
        if (timeout >= 1 && timeout < Infinity) {
          remote.setHeartbeatInterval((timeout - 1) * 1000);
        }

        // These are options that will be passed as query params to the
        // test harness page
        const queryOptions: Partial<RemoteConfig> = {
          basePath: serverUrl.pathname || undefined,
          runInSync: config.runInSync || false,
          serverUrl: serverUrl.href,
          sessionId: sessionId,
          socketPort: server.socketPort
        };

        // Do some pre-serialization of the options
        const queryParams: { [key: string]: any } = {};
        Object.keys(queryOptions)
          .filter(option => {
            const key = <keyof RemoteConfig>option;
            return queryOptions[key] != null;
          })
          .forEach(option => {
            const key = <keyof RemoteConfig>option;
            let value = queryOptions[key];
            if (typeof value === 'object') {
              value = JSON.stringify(value);
            }
            queryParams[key] = value;
          });

        const query = stringifyQuery(queryParams);
        const harness = `${config.serverUrl}__intern/remote.html`;

        // Determine the relative path from basePath to internPath. This
        // will be used to derive the internPath sent to the remote. The
        // remote will figure out its own basePath.
        const internPath = relative(config.basePath, config.internPath);

        // These are options that will be POSTed to the remote page and
        // used to configure intern. Stringify and parse them to ensure
        // that the config can be properly transmitted.
        const disableDomUpdates =
          config.remoteOptions && config.remoteOptions.disableDomUpdates;
        const remoteReporters = disableDomUpdates ? [] : [{ name: 'dom' }];
        const remoteConfig: Partial<RemoteConfig> = {
          debug: config.debug,
          internPath: `${serverUrl.pathname}${internPath}`,
          name: this.id,
          reporters: remoteReporters
        };

        // Don't overwrite any config data we've already set
        const excludeKeys: { [key: string]: boolean } = {
          basePath: true,
          internPath: true,
          name: true,
          reporters: true,
          serverUrl: true,
          sessionId: true,
          socketPort: true
        };

        // Pass all non-excluded keys to the remote config
        Object.keys(config)
          .filter(key => !excludeKeys[key])
          .forEach(property => {
            const key = <keyof RemoteConfig>property;
            (remoteConfig as any)[key] = config[key];
          });

        this.executor.log(
          'Configuring remote "',
          this.name,
          '" with',
          remoteConfig
        );

        remote
          .get(`${harness}?${query}`)
          .then(() => pendingConnection.promise)
          // Send the config data in an execute block to avoid sending
          // very large query strings
          .execute(
            /* istanbul ignore next */ function (configString: string) {
              const options = JSON.parse(configString);
              intern.configure(options);
              intern.run().catch(_error => {});
            },
            [stringify(remoteConfig)]
          )
          // If there's an error loading the page, kill the heartbeat
          // and fail
          .catch(error =>
            remote.setHeartbeatInterval(0).finally(() => handleError(error))
          );
      },
      // Canceller
      () => remote.setHeartbeatInterval(0)
    )
      .catch(error => {
        if (!this.error) {
          this.error = error;
        }
        throw error;
      })
      .finally(() => {
        if (connectTimer) {
          clearTimeout(connectTimer);
        }
        listenerHandle.destroy();
      })
      .finally(() => this.executor.emit('suiteEnd', this));
  }
}

export interface RemoteEvents extends NodeEvents {
  remoteStatus: string;
}

export interface RemoteConfig extends Config {
  serverUrl: string;
  sessionId: string;
  runInSync: boolean;
  socketPort?: number;
}
