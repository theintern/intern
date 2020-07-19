import { mkdtempSync } from 'fs';
import { sync as glob } from 'glob';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { ObjectSuiteDescriptor } from '@theintern/core/dist/lib/interfaces/object';
import { TestFunction } from '@theintern/core/dist/lib/Test';
import { mockImport } from '@theintern-dev/test-util';

import _SeleniumTunnel from '../../src/SeleniumTunnel';
import { BrowserName } from '../../src/types';
import { startStopTest } from '../support/integration';
import { /*cleanup,*/ deleteTunnelFiles, getDigdugArgs } from '../support/util';

let SeleniumTunnel: typeof _SeleniumTunnel;
let tunnel: _SeleniumTunnel;

const mockProcess = {
  arch: process.arch,
  platform: process.platform
};

type DownloadTestOptions = {
  artifact: string;
  arch?: string;
  platform?: NodeJS.Platform;
  driver: {
    browserName: BrowserName;
    version?: string;
  };
};

async function downloadTest(
  SeleniumTunnel: typeof _SeleniumTunnel,
  options?: DownloadTestOptions
) {
  if (options?.arch) {
    mockProcess.arch = options.arch;
  }
  if (options?.platform) {
    mockProcess.platform = options.platform;
  }

  const drivers = options?.driver ? [options.driver] : [];

  tunnel = new SeleniumTunnel({
    directory: mkdtempSync(join(tmpdir(), 'intern-test')),
    drivers
  });

  // Check that the progress callback is called
  let progressed = false;

  tunnel.on('downloadprogress', () => {
    progressed = true;
  });

  await tunnel.download();

  const artifact = options
    ? join(tunnel.directory, options.artifact)
    : join(tunnel.directory, tunnel.artifact);
  assert(glob(artifact)[0] != null, `expected ${artifact} to exist`);
  assert.isTrue(progressed, 'expected to have seen progress');
}

// artifact is a glob pattern that should match the downloaded file, relative to
// the base tunnel directory
const testConfigs: DownloadTestOptions[] = [
  {
    driver: { browserName: 'chrome' },
    platform: 'win32',
    artifact: '*/*/chromedriver.exe'
  },
  {
    driver: { browserName: 'chrome' },
    platform: 'linux',
    arch: 'x64',
    artifact: '*/*/chromedriver'
  },
  {
    driver: {
      browserName: 'chrome',
      version: '2.35'
    },
    platform: 'darwin',
    artifact: '2.35/*/chromedriver'
  },
  {
    driver: {
      browserName: 'chrome',
      version: '2.36'
    },
    platform: 'darwin',
    artifact: '2.36/*/chromedriver'
  },
  {
    driver: { browserName: 'ie' },
    arch: 'x64',
    artifact: '*/x64/IEDriverServer.exe'
  },
  {
    driver: { browserName: 'ie' },
    arch: 'x86',
    artifact: '*/x86/IEDriverServer.exe'
  },
  {
    driver: { browserName: 'internet explorer' },
    artifact: '*/*/IEDriverServer.exe'
  },
  {
    driver: { browserName: 'edge' },
    artifact: '*/MicrosoftWebDriver.exe'
  },
  {
    driver: { browserName: 'MicrosoftEdge' },
    artifact: '*/MicrosoftWebDriver.exe'
  },
  {
    driver: {
      browserName: 'MicrosoftEdgeChromium'
    },
    platform: 'win32',
    arch: 'x64',
    artifact: '*/x64/msedgedriver.exe'
  },
  {
    driver: {
      browserName: 'MicrosoftEdgeChromium'
    },
    platform: 'win32',
    arch: 'x86',
    artifact: '*/x86/msedgedriver.exe'
  },
  {
    driver: {
      browserName: 'MicrosoftEdgeChromium'
    },
    platform: 'darwin',
    artifact: '*/*/msedgedriver'
  },
  {
    driver: { browserName: 'firefox' },
    platform: 'linux',
    artifact: '*/*/geckodriver'
  },
  {
    driver: { browserName: 'firefox' },
    platform: 'darwin',
    artifact: '*/*/geckodriver'
  },
  {
    driver: { browserName: 'firefox' },
    platform: 'win32',
    artifact: '*/*/geckodriver.exe'
  }
];

const driverDownloadTests: { [name: string]: TestFunction } = {};

for (const cfg of testConfigs) {
  // The name of the download test is a combination of the browser name and
  // other test options
  let name = cfg.driver.browserName;
  if (cfg.driver.version) {
    name += `-${cfg.driver.version}`;
  }
  if (cfg.platform) {
    name += `-${cfg.platform}`;
  }
  if (cfg.arch) {
    name += `-${cfg.arch}`;
  }

  driverDownloadTests[name] = async () => {
    await downloadTest(SeleniumTunnel, cfg);
  };
}

const suite: ObjectSuiteDescriptor = {
  async before() {
    ({ default: SeleniumTunnel } = await mockImport(
      () => import('../../src/SeleniumTunnel'),
      replace => {
        replace(() => import('@theintern/common'))
          .transparently()
          .with({
            global: {
              process: mockProcess
            }
          });
      }
    ));
  },

  beforeEach() {
    this.timeout = 10 * 60 * 1000; // ten minutes
    mockProcess.arch = process.arch;
    mockProcess.platform = process.platform;
  },

  afterEach() {
    // return cleanup(tunnel);
  },

  tests: {
    async 'selenium download'() {
      await downloadTest(SeleniumTunnel);
    },

    'driver downloads': driverDownloadTests,

    'start/stop'() {
      return startStopTest(this, SeleniumTunnel, {
        needsAuthData: false,
        // Use a non-standard port to not conflict with a running tunnel in the
        // host Intern
        port: 39823
      });
    },

    isDownloaded() {
      const args = getDigdugArgs();
      if (args.noClean) {
        return this.skip('Cleanup is disabled');
      }

      tunnel = new SeleniumTunnel();
      deleteTunnelFiles(tunnel);

      assert.isFalse(tunnel.isDownloaded);
    },

    'version check': async function () {
      const version = '79.0.3945.36';
      const { arch } = process;
      tunnel = new SeleniumTunnel({
        directory: mkdtempSync(join(tmpdir(), 'intern-test')),
        drivers: [{ browserName: 'chrome', version }]
      });

      await tunnel.download();

      const driver = join(tunnel.directory, version, arch, 'chromedriver');
      const result = execSync(`"${driver}" --version`).toString('utf-8');
      assert.match(
        result,
        new RegExp(`ChromeDriver ${version}.`),
        'unexpected driver version'
      );
    }
  }
};

registerSuite('integration/SeleniumTunnel', suite);
