import Tunnel, {
  TunnelProperties,
  ChildExecutor,
  NormalizedEnvironment
} from './Tunnel';
import { existsSync, watchFile, unlinkSync, unwatchFile } from 'fs';
import { stringify } from 'querystring';
import { tmpdir } from 'os';
import { join } from 'path';
import { request, CancellablePromise } from '../common';
import { parse } from 'url';
import { fileExists, on } from './lib/util';
import { JobState } from './interfaces';

/**
 * A TestingBot tunnel.
 *
 * The username and accessKey properties will be initialized using
 * TESTINGBOT_API_KEY and TESTINGBOT_API_SECRET.
 */
export default class TestingBotTunnel extends Tunnel
  implements TestingBotProperties {
  directory!: string;

  /**
   * A list of regular expressions corresponding to domains whose connections
   * should fail immediately if the VM attempts to make a connection to them.
   */
  fastFailDomains!: string[];

  /** A filename where additional logs from the tunnel should be output. */
  logFile!: string | null;

  /** Whether or not to use rabbIT compression for the tunnel connection. */
  useCompression!: boolean;

  /** Whether or not to use the default local Jetty proxy for the tunnel. */
  useJettyProxy!: boolean;

  /** Whether or not to use the default remote Squid proxy for the VM. */
  useSquidProxy!: boolean;

  /**
   * Whether or not to re-encrypt data encrypted by self-signed certificates.
   */
  useSsl!: boolean;

  constructor(options?: TestingBotOptions) {
    super(
      Object.assign(
        {
          username: process.env.TESTINGBOT_KEY,
          accessKey: process.env.TESTINGBOT_SECRET,
          directory: join(__dirname, 'testingbot'),
          environmentUrl: 'https://api.testingbot.com/v1/browsers',
          executable: 'java',
          fastFailDomains: [],
          logFile: null,
          port: 4445,
          url: 'https://testingbot.com/downloads/testingbot-tunnel.zip',
          useCompression: false,
          useJettyProxy: true,
          useSquidProxy: true,
          useSsl: false
        },
        options || {}
      )
    );
  }

  get auth() {
    return `${this.username || ''}:${this.accessKey || ''}`;
  }

  get isDownloaded() {
    return fileExists(
      join(this.directory, 'testingbot-tunnel/testingbot-tunnel.jar')
    );
  }

  protected _makeArgs(readyFile: string): string[] {
    if (!this.username || !this.accessKey) {
      throw new Error('TestingBotTunnel requires a username and access key');
    }

    const args = [
      '-jar',
      join(this.directory, 'testingbot-tunnel', 'testingbot-tunnel.jar'),
      this.username,
      this.accessKey,
      '-P',
      this.port,
      '-f',
      readyFile
    ];

    this.fastFailDomains.length &&
      args.push('-F', this.fastFailDomains.join(','));
    this.logFile && args.push('-l', this.logFile);
    this.useJettyProxy || args.push('-x');
    this.useSquidProxy || args.push('-q');
    this.useCompression && args.push('-b');
    this.useSsl && args.push('-s');
    this.verbose && args.push('-d');

    if (this.proxy) {
      const proxy = parse(this.proxy);

      proxy.hostname && args.unshift('-Dhttp.proxyHost=', proxy.hostname);
      proxy.port && args.unshift('-Dhttp.proxyPort=', proxy.port);
    }

    return args;
  }

  sendJobState(jobId: string, data: JobState): CancellablePromise<void> {
    const params: { [key: string]: string | number } = {};

    if (data.success != null) {
      params['test[success]'] = String(data.success ? 1 : 0);
    }
    if (data.status) {
      params['test[status_message]'] = data.status;
    }
    if (data.name) {
      params['test[name]'] = data.name;
    }
    if (data.extra) {
      params['test[extra]'] = JSON.stringify(data.extra);
    }
    if (data.tags && data.tags.length) {
      params['groups'] = data.tags.join(',');
    }

    const url = `https://api.testingbot.com/v1/tests/${jobId}`;
    const payload = stringify(params);
    return request(url, {
      method: 'put',
      data: payload,
      headers: {
        'Content-Length': String(Buffer.byteLength(payload, 'utf8')),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      password: this.accessKey,
      username: this.username,
      proxy: this.proxy
    }).then(function(response) {
      return response.text().then(text => {
        if (text) {
          const data = JSON.parse(text);

          if (data.error) {
            throw new Error(data.error);
          } else if (!data.success) {
            throw new Error('Job data failed to save.');
          } else if (response.status !== 200) {
            throw new Error(`Server reported ${response.status} with: ${text}`);
          }
        } else {
          throw new Error(
            `Server reported ${response.status} with no other data.`
          );
        }
      });
    });
  }

  protected _start(executor: ChildExecutor) {
    const readyFile = join(tmpdir(), 'testingbot-' + Date.now());

    return this._makeChild((child, resolve, reject) => {
      function _reject(message: string) {
        const pidFile = 'testingbot-tunnel.pid';
        if (existsSync(pidFile)) {
          // Remove the pidfile to ensure the running tunnel app shuts
          // down
          unlinkSync(pidFile);
        }
        reject(message);
      }

      // Polling API is used because we are only watching for one file, so
      // efficiency is not a big deal, and the `fs.watch` API has extra
      // restrictions which are best avoided
      watchFile(readyFile, { persistent: false, interval: 1007 }, function(
        current,
        previous
      ) {
        if (Number(current.mtime) === Number(previous.mtime)) {
          // readyFile hasn't been modified, so ignore the event
          return;
        }

        unwatchFile(readyFile);
        resolve();
      });

      let lastMessage: string;
      this._handle = on(child.stderr!, 'data', (data: string) => {
        data = String(data);
        data.split('\n').forEach(message => {
          if (message.indexOf('INFO: ') === 0) {
            message = message.slice('INFO: '.length);
            // the tunnel produces a lot of repeating messages
            // during setup when the status is pending; deduplicate
            // them for sanity
            if (
              message !== lastMessage &&
              message.indexOf('>> [') === -1 &&
              message.indexOf('<< [') === -1
            ) {
              this.emit({
                type: 'status',
                target: this,
                status: message
              });
              lastMessage = message;
            }
          } else if (message.indexOf('SEVERE: ') === 0) {
            _reject(message);
          } else if (message.indexOf('An error ocurred:') === 0) {
            _reject(message);
          }
        });
      });

      executor(child, resolve, reject);
    }, readyFile);
  }

  /**
   * Attempt to normalize a TestingBot described environment with the standard
   * Selenium capabilities
   *
   * TestingBot returns a list of environments that looks like:
   *
   * {
   *     "selenium_name": "Chrome36",
   *     "name": "googlechrome",
   *     "platform": "CAPITAN",
   *     "version":"36"
   * }
   *
   * @param environment a TestingBot environment descriptor
   * @returns a normalized descriptor
   */
  protected _normalizeEnvironment(environment: any): NormalizedEnvironment {
    const browserMap: any = {
      googlechrome: 'chrome',
      iexplore: 'internet explorer'
    };

    const platform = environment.platform;
    const browserName = browserMap[environment.name] || environment.name;
    const version = environment.version;

    return {
      platform,
      browserName,
      version,
      descriptor: environment,

      intern: {
        platform,
        browserName,
        version
      }
    };
  }
}

/**
 * Options specific to TestingBotTunnel
 */
export interface TestingBotProperties extends TunnelProperties {
  /** [[TestingBotTunnel.TestingBotTunnel.fastFailDomains|More info]] */
  fastFailDomains: string[];

  /** [[TestingBotTunnel.TestingBotTunnel.logFile|More info]] */
  logFile: string | null;

  /** [[TestingBotTunnel.TestingBotTunnel.useCompression|More info]] */
  useCompression: boolean;

  /** [[TestingBotTunnel.TestingBotTunnel.useJettyProxy|More info]] */
  useJettyProxy: boolean;

  /** [[TestingBotTunnel.TestingBotTunnel.useSquidProxy|More info]] */
  useSquidProxy: boolean;

  /** [[TestingBotTunnel.TestingBotTunnel.useSsl|More info]] */
  useSsl: boolean;
}

export type TestingBotOptions = Partial<TestingBotProperties>;
