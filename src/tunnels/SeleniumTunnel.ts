import Tunnel, {
  TunnelProperties,
  DownloadOptions,
  ChildExecutor
} from './Tunnel';
import { format } from 'util';
import { join } from 'path';
import { Handle, Task, CancellablePromise } from '../common';
import { fileExists, kill, on, writeFile } from './lib/util';
import { satisfies } from 'semver';
import { sync as commandExistsSync } from 'command-exists';
import { drivers } from './webdrivers.json';

/**
 * A Selenium tunnel. This tunnel downloads the
 * [[http://www.seleniumhq.org/download/|Selenium-standalone server]] and any
 * necessary WebDriver executables, and handles starting and stopping Selenium.
 *
 * The primary configuration option is [[SeleniumTunnel.drivers|drivers]], which
 * determines which browsers the Selenium tunnel will support.
 *
 * Note that Java must be installed and in the system path to use this tunnel.
 *
 * The standard browser names (for the `browserName` WebDriver capability) are:
 *
 * - `MicrosoftEdge`
 * - `chrome`
 * - `firefox`
 * - `internet explorer`
 * - `safari`
 */
export default class SeleniumTunnel extends Tunnel
  implements SeleniumProperties {
  /** Additional arguments to send to the Selenium server at startup */
  seleniumArgs!: string[];

  /**
   * The desired Selenium drivers to download. Each entry may be a string or an
   * object. Strings must be the names of existing drivers in SeleniumTunnel
   * (see below). An object with a 'name' property is a configuration object --
   * the name must be the name of an existing driver in SeleniumTunnel, and the
   * remaining properties will be used to configure that driver. An object
   * without a 'name' property is a driver definition. It must contain three
   * properties:
   *
   * - `executable` - the name of the driver executable, one of:
   * - `url` - the URL where the driver can be downloaded from
   * - `seleniumProperty` - the name of the Java property used to tell
   *   Selenium where the driver is
   *
   * ```js
   * [
   *     'chrome',
   *     {
   *         name: 'firefox',
   *         version: '0.8.0'
   *     },
   *     {
   *         url: 'https://github.com/operasoftware/operachromiumdriver/releases/.../operadriver_mac64.zip',
   *         executable: 'operadriver',
   *         seleniumProperty: 'webdriver.opera.driver'
   *     }
   * ]
   * ```
   *
   * The built-in SeleniumTunnel drivers are:
   *
   * - 'chrome'
   * - 'firefox'
   * - 'internet explorer'
   * - 'ie' (alias for 'internet explorer')
   * - 'MicrosoftEdge'
   * - 'edge' (alias for 'MicrosoftEdge')
   *
   * @default [ 'chrome' ]
   */
  drivers!: DriverDescriptor[];

  /**
   * The base address where Selenium artifacts may be found.
   *
   * @default https://selenium-release.storage.googleapis.com
   */
  baseUrl!: string;

  /**
   * The desired version of selenium to install.
   *
   * @default 3.3.1
   */
  version!: string;

  /**
   * Timeout in milliseconds for communicating with the Selenium server
   *
   * @default 5000
   */
  seleniumTimeout!: number;

  constructor(options?: SeleniumOptions) {
    super(
      Object.assign(
        {
          seleniumArgs: [],
          drivers: ['chrome'],
          baseUrl: drivers.selenium.baseUrl,
          version: drivers.selenium.latest,
          seleniumTimeout: 5000
        },
        options || {}
      )
    );

    // Emit a meaningful error if Java isn't available
    if (!commandExistsSync('java')) {
      throw new Error('Java must be installed to use SeleniumTunnel');
    }
  }

  get artifact() {
    return `selenium-server-standalone-${this.version}.jar`;
  }

  get directory() {
    return join(__dirname, 'selenium-standalone');
  }

  get executable() {
    return 'java';
  }

  get isDownloaded() {
    const directory = this.directory;
    return (
      fileExists(join(directory, this.artifact)) &&
      this._getDriverConfigs().every(config => {
        return fileExists(join(directory, config.executable));
      })
    );
  }

  get url() {
    const majorMinorVersion = this.version.slice(
      0,
      this.version.lastIndexOf('.')
    );
    return format('%s/%s/%s', this.baseUrl, majorMinorVersion, this.artifact);
  }

  download(forceDownload = false): CancellablePromise<void> {
    if (!forceDownload && this.isDownloaded) {
      return Task.resolve();
    }

    let tasks: CancellablePromise<void>[];

    return new Task(
      resolve => {
        const configs: RemoteFile[] = [
          {
            url: this.url,
            executable: this.artifact,
            dontExtract: true
          },
          ...this._getDriverConfigs()
        ];

        tasks = configs.map(config => {
          const executable = config.executable;
          const dontExtract = Boolean(config.dontExtract);
          const directory = config.directory;

          if (fileExists(join(this.directory, executable))) {
            return Task.resolve();
          }

          // TODO: progress events
          return this._downloadFile(config.url, this.proxy, <
            SeleniumDownloadOptions
          >{
            executable,
            dontExtract,
            directory
          });
        });

        resolve(Task.all(tasks).then(() => {}));
      },
      () => {
        tasks &&
          tasks.forEach(task => {
            task.cancel();
          });
      }
    );
  }

  sendJobState(): CancellablePromise<void> {
    // This is a noop for Selenium
    return Task.resolve();
  }

  protected _getDriverConfigs(): DriverFile[] {
    function getDriverConfig(name: string, options?: any) {
      const Constructor = driverNameMap[name];
      if (!Constructor) {
        throw new Error('Invalid driver name "' + name + '"');
      }
      return new Constructor(options);
    }

    return this.drivers.map(function(data) {
      if (typeof data === 'string') {
        return getDriverConfig(data);
      }

      if (typeof data === 'object' && (<any>data).name) {
        return getDriverConfig((<any>data).name, data);
      }

      // data is a driver definition
      return <DriverFile>data;
    });
  }

  protected _makeArgs(): string[] {
    const directory = this.directory;
    const driverConfigs = this._getDriverConfigs();
    const args: string[] = [];

    driverConfigs.reduce(function(args: string[], config) {
      const file = join(directory, config.executable);
      args.push('-D' + config.seleniumProperty + '=' + file);
      return args;
    }, args);

    if (this.seleniumArgs) {
      args.push(...this.seleniumArgs);
    }

    args.push('-jar', join(this.directory, this.artifact), '-port', this.port);

    if (this.verbose) {
      args.push('-debug');
      if (satisfies(this.version, '>=3.1.0 <3.5.0')) {
        args.push('true');
      }
      console.log('Starting with arguments: ', args.join(' '));
    }

    return args;
  }

  protected _postDownloadFile(data: Buffer, options: SeleniumDownloadOptions) {
    const executable = options.executable!;
    if (options.dontExtract) {
      return writeFile(data, join(this.directory, executable));
    }
    return super._postDownloadFile(data, options);
  }

  protected _start(executor: ChildExecutor) {
    let handle: Handle;
    const task = this._makeChild((child, resolve, reject) => {
      handle = on(child.stderr!, 'data', (data: string) => {
        // Selenium recommends that we poll the hub looking for a status
        // response
        // https://github.com/seleniumhq/selenium-google-code-issue-archive/issues/7957
        // We're going against the recommendation here for a few reasons
        // 1. There's no default pid or log to look for errors to
        //    provide a specific failure
        // 2. Polling on a failed server start could leave us with an
        //    unpleasant wait
        // 3. Just polling a selenium server doesn't guarantee it's the
        //    server we started
        // 4. This works pretty well
        data = String(data);
        if (data.indexOf('Selenium Server is up and running') > -1) {
          resolve();
        } else if (
          /Address already in use/.test(data) ||
          /Port \d+ is busy/.test(data)
        ) {
          reject(new Error('Address is already in use'));

          // Kill the child since we're reporting that startup failed
          kill(child.pid);
        }
      });

      if (this.verbose) {
        on(child.stderr!, 'data', (data: string) => {
          process.stderr.write(data);
        });
      }

      executor(child, resolve, reject);
    });

    task.then(
      () => handle.destroy(),
      () => handle.destroy()
    );

    return task;
  }
}

export interface DriverFile extends RemoteFile {
  seleniumProperty: string;
}

export interface RemoteFile {
  dontExtract?: boolean;
  directory?: string;
  executable: string;
  url: string;
}

export type DriverDescriptor =
  | string
  | DriverFile
  | { name: string; version?: string };

/**
 * Options specific to SeleniumTunnel
 */
export interface SeleniumProperties extends TunnelProperties {
  /** [[SeleniumTunnel.SeleniumTunnel.seleniumArgs|More info]] */
  seleniumArgs: string[];

  /** [[SeleniumTunnel.SeleniumTunnel.drivers|More info]] */
  drivers: DriverDescriptor[];

  /** [[SeleniumTunnel.SeleniumTunnel.baseUrl|More info]] */
  baseUrl: string;

  /** [[SeleniumTunnel.SeleniumTunnel.version|More info]] */
  version: string;

  /** [[SeleniumTunnel.SeleniumTunnel.seleniumTimeout|More info]] */
  seleniumTimeout: number;
}

export type SeleniumOptions = Partial<SeleniumProperties>;

export interface SeleniumDownloadOptions extends DownloadOptions {
  executable?: string;
  dontExtract?: boolean;
}

type DriverConstructor = { new (config?: any): DriverFile };

abstract class Config<T extends object> {
  constructor(config: T) {
    Object.assign(this, config);
  }

  abstract readonly executable: string;
  abstract readonly url: string;
  abstract readonly seleniumProperty?: string;
}

interface ChromeProperties {
  arch: string;
  baseUrl: string;
  platform: string;
  version: string;
}

type ChromeOptions = Partial<ChromeProperties>;

class ChromeConfig extends Config<ChromeOptions>
  implements ChromeProperties, DriverFile {
  arch!: string;
  baseUrl!: string;
  platform!: string;
  version!: string;

  constructor(options: ChromeOptions) {
    super(
      Object.assign(
        {
          arch: process.arch,
          baseUrl: drivers.chrome.baseUrl,
          platform: process.platform,
          version: drivers.chrome.latest
        },
        options
      )
    );
  }

  get artifact() {
    let platform = this.platform;
    if (platform === 'linux') {
      platform = 'linux' + (this.arch === 'x86' ? '32' : '64');
    } else if (platform === 'darwin') {
      const parts = String(this.version)
        .split('.')
        .map(Number);
      const isGreater = [2, 22].some(function(part, i) {
        return parts[i] > part;
      });
      platform = isGreater ? 'mac64' : 'mac32';
    }
    return format('chromedriver_%s.zip', platform);
  }

  get directory() {
    return join(this.version, this.arch);
  }

  get url() {
    return format('%s/%s/%s', this.baseUrl, this.version, this.artifact);
  }

  get executable() {
    return join(
      this.directory,
      this.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver'
    );
  }

  get seleniumProperty() {
    return 'webdriver.chrome.driver';
  }
}

interface FirefoxProperties {
  arch: string;
  baseUrl: string;
  platform: string;
  version: string;
}

type FirefoxOptions = Partial<FirefoxProperties>;

class FirefoxConfig extends Config<FirefoxOptions>
  implements FirefoxProperties, DriverFile {
  arch!: string;
  baseUrl!: string;
  platform!: string;
  version!: string;

  constructor(options: FirefoxOptions) {
    super(
      Object.assign(
        {
          arch: process.arch,
          baseUrl: drivers.firefox.baseUrl,
          platform: process.platform,
          version: drivers.firefox.latest
        },
        options
      )
    );
  }

  get artifact() {
    let platform = this.platform;
    if (platform === 'linux') {
      platform = 'linux' + (this.arch === 'x64' ? '64' : '32');
    } else if (platform === 'win32') {
      platform = 'win' + (this.arch === 'x64' ? '64' : '32');
    } else if (platform === 'darwin') {
      platform = 'macos';
    }
    const extension = /^win/.test(platform) ? '.zip' : '.tar.gz';
    return format('geckodriver-v%s-%s%s', this.version, platform, extension);
  }

  get url() {
    return format('%s/v%s/%s', this.baseUrl, this.version, this.artifact);
  }

  get directory() {
    return join(this.version, this.arch);
  }

  get executable() {
    return join(
      this.directory,
      this.platform === 'win32' ? 'geckodriver.exe' : 'geckodriver'
    );
  }

  get seleniumProperty() {
    return 'webdriver.gecko.driver';
  }
}

// tslint:disable-next-line:interface-name
interface IEProperties {
  arch: string;
  baseUrl: string;
  version: string;
}

type IEOptions = Partial<IEProperties>;

class IEConfig extends Config<IEOptions> implements IEProperties, DriverFile {
  arch!: string;
  baseUrl!: string;
  version!: string;

  constructor(options: IEOptions) {
    super(
      Object.assign(
        {
          arch: process.arch,
          baseUrl: drivers.ie.baseUrl,
          version: drivers.ie.latest
        },
        options
      )
    );
  }

  get artifact() {
    const architecture = this.arch === 'x64' ? 'x64' : 'Win32';
    return format('IEDriverServer_%s_%s.zip', architecture, this.version);
  }

  get url() {
    const majorMinorVersion = this.version.slice(
      0,
      this.version.lastIndexOf('.')
    );
    return format('%s/%s/%s', this.baseUrl, majorMinorVersion, this.artifact);
  }

  get directory() {
    return join(this.version, this.arch);
  }

  get executable() {
    return join(this.directory, 'IEDriverServer.exe');
  }

  get seleniumProperty() {
    return 'webdriver.ie.driver';
  }
}

interface EdgeProperties {
  baseUrl: string;
  uuid: string | undefined;
  version: string;
  versions: EdgeVersions;
}

interface EdgeVersions {
  [version: string]: { url: string };
}

type EdgeOptions = Partial<EdgeProperties>;

class EdgeConfig extends Config<EdgeOptions>
  implements EdgeProperties, DriverFile {
  arch!: string;
  baseUrl!: string;
  uuid: string | undefined;
  version!: keyof typeof drivers.edge.versions;
  versions!: EdgeVersions;

  constructor(options: EdgeOptions) {
    super(
      Object.assign(
        {
          arch: process.arch,
          baseUrl: drivers.edge.baseUrl,
          version: drivers.edge.latest,
          versions: drivers.edge.versions
        },
        options
      )
    );
  }

  get dontExtract() {
    return true;
  }

  get url() {
    const { uuid } = this;

    if (uuid) {
      const a = uuid[0];
      const b = uuid[1];
      const c = uuid[2];

      return format(
        '%s/%s/%s/%s/%s/%s',
        this.baseUrl,
        a,
        b,
        c,
        uuid,
        this.artifact
      );
    }

    const urlOrObj = drivers.edge.versions[this.version].url;
    if (typeof urlOrObj === 'string') {
      return urlOrObj;
    }

    return urlOrObj[this.arch as keyof typeof urlOrObj];
  }

  get artifact() {
    return 'MicrosoftWebDriver.exe';
  }

  get directory() {
    return this.version;
  }

  get executable() {
    return join(this.version, 'MicrosoftWebDriver.exe');
  }

  get seleniumProperty() {
    return 'webdriver.edge.driver';
  }
}

interface EdgeChromiumProperties {
  arch: string;
  baseUrl: string;
  platform: string;
  version: string;
}

class EdgeChromiumConfig extends Config<EdgeOptions>
  implements EdgeChromiumProperties, DriverFile {
  arch!: string;
  baseUrl!: string;
  platform!: string;
  version!: string;

  constructor(options: ChromeOptions) {
    super(
      Object.assign(
        {
          arch: process.arch,
          baseUrl: drivers.edgeChromium.baseUrl,
          platform: process.platform,
          version: drivers.edgeChromium.latest
        },
        options
      )
    );
  }

  get artifact() {
    const platform = edgePlatformNames[this.platform] || this.platform;
    const arch = this.arch === 'x86' ? '32' : '64';
    return format('edgedriver_%s%s.zip', platform, arch);
  }

  get directory() {
    return join(this.version, this.arch);
  }

  get url() {
    return format('%s/%s/%s', this.baseUrl, this.version, this.artifact);
  }

  get executable() {
    return join(
      this.directory,
      this.platform === 'win32' ? 'msedgedriver.exe' : 'msedgedriver'
    );
  }

  get seleniumProperty() {
    return 'webdriver.edge.driver';
  }
}

const edgePlatformNames: { [key: string]: string } = {
  darwin: 'mac',
  win32: 'win',
  win64: 'win'
};

const driverNameMap: { [key: string]: DriverConstructor } = {
  chrome: ChromeConfig,
  firefox: FirefoxConfig,
  ie: IEConfig,
  'internet explorer': IEConfig,
  edge: EdgeConfig,
  MicrosoftEdge: EdgeConfig,
  edgeChromium: EdgeChromiumConfig,
  MicrosoftEdgeChromium: EdgeChromiumConfig
};
