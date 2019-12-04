import { chmodSync } from 'fs';
import { join } from 'path';
import { CancellablePromise, request } from '../common';
import Tunnel, {
  TunnelProperties,
  DownloadOptions,
  ChildExecutor,
  NormalizedEnvironment
} from './Tunnel';
import { parse as parseUrl, Url } from 'url';
import { JobState } from './interfaces';
import { kill, on } from './lib/util';

/**
 * A BrowserStack tunnel.
 *
 * The accessKey and username properties will be initialized using
 * BROWSERSTACK_ACCESS_KEY and BROWSERSTACK_USERNAME.
 */
export default class BrowserStackTunnel extends Tunnel
  implements BrowserStackProperties {
  /**
   * Whether or not to start the tunnel with only WebDriver support. Setting
   * this value to `false` is not supported.
   */
  automateOnly!: true;

  /**
   * The URL of a service that provides a list of environments supported by
   * the tunnel.
   */
  environmentUrl!: string;

  /**
   * If true, any other tunnels running on the account will be killed when
   * the tunnel is started.
   */
  killOtherTunnels!: boolean;

  /**
   * A list of server URLs that should be proxied by the tunnel. Only the
   * hostname, port, and protocol are used.
   */
  servers!: (Url | string)[];

  /**
   * Skip verification that the proxied servers are online and responding at
   * the time the tunnel starts.
   */
  skipServerValidation!: boolean;

  /** If true, route all traffic via the local machine. */
  forceLocal!: boolean;

  constructor(options?: BrowserStackOptions) {
    super(
      Object.assign(
        {
          accessKey: process.env.BROWSERSTACK_ACCESS_KEY,
          automateOnly: true,
          directory: join(__dirname, 'browserstack'),
          environmentUrl: 'https://www.browserstack.com/automate/browsers.json',
          forceLocal: false,
          hostname: 'hub.browserstack.com',
          killOtherTunnels: false,
          port: '443',
          protocol: 'https',
          servers: [],
          skipServerValidation: true,
          username: process.env.BROWSERSTACK_USERNAME
        },
        options || {}
      )
    );
  }

  get auth() {
    return `${this.username || ''}:${this.accessKey || ''}`;
  }

  get executable() {
    return join(
      this.directory,
      `BrowserStackLocal${this.platform === 'win32' ? '.exe' : ''}`
    );
  }

  get extraCapabilities(): Object {
    const capabilities: any = {
      'browserstack.local': 'true'
    };

    if (this.tunnelId) {
      capabilities['browserstack.localIdentifier'] = this.tunnelId;
    }

    return capabilities;
  }

  get url() {
    const platform = this.platform;
    const architecture = this.architecture;
    let url =
      'https://www.browserstack.com/browserstack-local/BrowserStackLocal-';

    if (platform === 'darwin' && architecture === 'x64') {
      url += platform + '-' + architecture;
    } else if (platform === 'win32') {
      url += platform;
    } else if (
      platform === 'linux' &&
      (architecture === 'ia32' || architecture === 'x64')
    ) {
      url += platform + '-' + architecture;
    } else {
      throw new Error(platform + ' on ' + architecture + ' is not supported');
    }

    url += '.zip';
    return url;
  }

  protected _postDownloadFile(
    data: Buffer,
    options?: DownloadOptions
  ): Promise<void> {
    return super._postDownloadFile(data, options).then(() => {
      const executable = this.executable;
      chmodSync(executable, parseInt('0755', 8));
    });
  }

  protected _makeArgs(..._values: string[]): string[] {
    if (!this.username || !this.accessKey) {
      throw new Error('BrowserStackTunnel requires a username and access key');
    }

    const args = [
      this.accessKey,
      this.servers
        .map(function(server) {
          const url = parseUrl(String(server));
          return [
            url.hostname,
            url.port,
            url.protocol === 'https:' ? 1 : 0
          ].join(',');
        })
        .join(',')
    ];

    this.automateOnly && args.push('-onlyAutomate');
    this.forceLocal && args.push('-forcelocal');
    this.killOtherTunnels && args.push('-force');
    this.skipServerValidation && args.push('-skipCheck');
    this.tunnelId && args.push('-localIdentifier', this.tunnelId);
    this.verbose && args.push('-v');
    const aProxy =
      typeof this.tunnelProxy !== 'undefined' ? this.tunnelProxy : this.proxy;

    if (aProxy) {
      const proxy = parseUrl(aProxy);
      proxy.hostname && args.push('-proxyHost', proxy.hostname);
      proxy.port && args.push('-proxyPort', proxy.port);

      if (proxy.auth) {
        const auth = proxy.auth.split(':');
        args.push('-proxyUser', auth[0], '-proxyPass', auth[1]);
      }
    }

    return args;
  }

  sendJobState(jobId: string, data: JobState): CancellablePromise<void> {
    const payload = JSON.stringify({
      status: data.status || data.success ? 'completed' : 'error'
    });

    const url = `https://www.browserstack.com/automate/sessions/${jobId}.json`;
    return request(url, {
      method: 'put',
      data: payload,
      headers: {
        'Content-Length': String(Buffer.byteLength(payload, 'utf8')),
        'Content-Type': 'application/json'
      },
      password: this.accessKey,
      username: this.username,
      proxy: this.proxy
    }).then<void>(response => {
      if (response.status < 200 || response.status >= 300) {
        return response.text().then(text => {
          throw new Error(
            text || `Server reported ${response.status} with no other data.`
          );
        });
      }
    });
  }

  protected _start(executor: ChildExecutor) {
    return this._makeChild((child, resolve, reject) => {
      let handle = on(child.stdout!, 'data', (data: any) => {
        data = String(data);
        const error = /\s*\*\*\* Error: (.*)$/m.exec(data);
        if (error) {
          handle.destroy();
          reject(new Error(`The tunnel reported: ${error[1]}`));
        } else if (
          data.indexOf(
            'You can now access your local server(s) in our remote browser'
          ) > -1
        ) {
          handle.destroy();
          resolve();
        } else {
          const line = data.replace(/^\s+/, '').replace(/\s+$/, '');
          if (
            /^BrowserStackLocal v/.test(line) ||
            /^Connecting to BrowserStack/.test(line) ||
            /^Connected/.test(line)
          ) {
            this.emit({
              type: 'status',
              target: this,
              status: line
            });
          }
        }
      });

      executor(child, resolve, reject);
    });
  }

  protected _stop(): Promise<number> {
    return new Promise(resolve => {
      const childProcess = this._process;
      if (!childProcess) {
        resolve();
        return;
      }

      let exited = false;

      childProcess.once('exit', function(code) {
        exited = true;
        resolve(code == null ? undefined : code);
      });
      kill(childProcess.pid);

      // As of at least version 5.1, BrowserStackLocal spawns a secondary
      // process. This is the one that needs to receive the CTRL-C, but
      // Node doesn't provide an easy way to get the PID of the secondary
      // process, so we'll just wait a few seconds, then kill the process
      // if it hasn't ended cleanly.
      setTimeout(function() {
        if (!exited) {
          kill(childProcess.pid);
        }
      }, 5000);
    });
  }

  /**
   * Attempt to normalize a BrowserStack described environment with the
   * standard Selenium capabilities
   *
   * BrowserStack returns a list of environments that looks like:
   *
   * {
   *     "browser": "opera",
   *     "os_version": "Lion",
   *     "browser_version":"12.15",
   *     "device": null,
   *     "os": "OS X"
   * }
   *
   * @param environment a BrowserStack environment descriptor
   * @returns a normalized descriptor
   */
  protected _normalizeEnvironment(environment: any): NormalizedEnvironment {
    const platformMap: any = {
      Windows: {
        '10': 'WINDOWS',
        '8.1': 'WIN8',
        '8': 'WIN8',
        '7': 'WINDOWS',
        XP: 'XP'
      },

      'OS X': 'MAC'
    };

    const browserMap: any = {
      ie: 'internet explorer'
    };

    // Create the BS platform name for a given os + version
    let platform = platformMap[environment.os] || environment.os;
    if (typeof platform === 'object') {
      platform = platform[environment.os_version];
    }

    const browserName = browserMap[environment.browser] || environment.browser;
    const version = environment.browser_version;

    return {
      platform,
      platformName: environment.os,
      platformVersion: environment.os_version,

      browserName,
      browserVersion: version,
      version: environment.browser_version,

      descriptor: environment,

      intern: {
        platform,
        browserName,
        version
      }
    };
  }
}

export interface BrowserStackProperties extends TunnelProperties {
  /** [[BrowserStackTunnel.BrowserStackTunnel.automateOnly|More info]] */
  automateOnly: true;

  /** [[BrowserStackTunnel.BrowserStackTunnel.killOtherTunnels|More info]] */
  killOtherTunnels: boolean;

  /** [[BrowserStackTunnel.BrowserStackTunnel.servers|More info]] */
  servers: (Url | string)[];

  /** [[BrowserStackTunnel.BrowserStackTunnel.skipServerValidation|More info]] */
  skipServerValidation: boolean;

  /** [[BrowserStackTunnel.BrowserStackTunnel.forceLocal|More info]] */
  forceLocal: boolean;

  /** [[BrowserStackTunnel.BrowserStackTunnel.environmentUrl|More info]] */
  environmentUrl: string;
}

export type BrowserStackOptions = Partial<BrowserStackProperties>;
