import { existsSync, mkdtempSync } from 'fs';
import { sync as glob } from 'glob';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { ObjectSuiteDescriptor } from 'src/core/lib/interfaces/object';
import { request } from 'src/common';
import { TestFunction } from 'src/core/lib/Test';
import { mockImport } from 'tests/support/mockUtil';
import webdriversJson from 'src/tunnels/webdrivers.json';

import _SeleniumTunnel from 'src/tunnels/SeleniumTunnel';
import { BrowserName } from 'src/tunnels/types';
import { startStopTest } from 'tests/support/integration';
import { cleanup, deleteTunnelFiles, getDigdugArgs } from 'tests/support/util';

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
    artifact: `${webdriversJson.drivers.chrome.latest}/*/chromedriver.exe`
  },
  {
    driver: { browserName: 'chrome' },
    platform: 'linux',
    arch: 'x64',
    artifact: `${webdriversJson.drivers.chrome.latest}/*/chromedriver`
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
    driver: { browserName: 'ie' },
    arch: 'x64',
    artifact: `${webdriversJson.drivers.ie.latest}/x64/IEDriverServer.exe`
  },
  {
    driver: { browserName: 'ie' },
    arch: 'x86',
    artifact: `${webdriversJson.drivers.ie.latest}/x86/IEDriverServer.exe`
  },
  {
    driver: { browserName: 'internet explorer' },
    artifact: `${webdriversJson.drivers.ie.latest}/*/IEDriverServer.exe`
  },
  {
    driver: { browserName: 'edge' },
    artifact: `${webdriversJson.drivers.edge.latest}/MicrosoftWebDriver.exe`
  },
  {
    driver: { browserName: 'MicrosoftEdge' },
    artifact: `${webdriversJson.drivers.edge.latest}/MicrosoftWebDriver.exe`
  },
  {
    driver: {
      browserName: 'MicrosoftEdgeChromium'
    },
    platform: 'win32',
    arch: 'x64',
    artifact: `${webdriversJson.drivers.edgeChromium.latest}/x64/msedgedriver.exe`
  },
  {
    driver: {
      browserName: 'MicrosoftEdgeChromium'
    },
    platform: 'win32',
    arch: 'x86',
    artifact: `${webdriversJson.drivers.edgeChromium.latest}/x86/msedgedriver.exe`
  },
  {
    driver: {
      browserName: 'MicrosoftEdgeChromium'
    },
    platform: 'darwin',
    artifact: `${webdriversJson.drivers.edgeChromium.latest}/*/msedgedriver`
  },
  {
    driver: { browserName: 'firefox' },
    platform: 'linux',
    artifact: `${webdriversJson.drivers.firefox.latest}/*/geckodriver`
  },
  {
    driver: { browserName: 'firefox' },
    platform: 'darwin',
    artifact: `${webdriversJson.drivers.firefox.latest}/*/geckodriver`
  },
  {
    driver: { browserName: 'firefox' },
    platform: 'win32',
    artifact: `${webdriversJson.drivers.firefox.latest}/*/geckodriver.exe`
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
      () => import('src/tunnels/SeleniumTunnel'),
      replace => {
        replace(() => import('src/common'))
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
    return cleanup(tunnel);
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

    'version check': async function() {
      const version = webdriversJson.drivers.chrome.latest;
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
    },

    'webdrivers.json download': (() => {
      let SeleniumTunnel: typeof _SeleniumTunnel;
      const mockData: typeof webdriversJson = JSON.parse(
        JSON.stringify(webdriversJson)
      );
      mockData.drivers.selenium.latest = '3.14.0';
      mockData.drivers.chrome.latest = '2.46';

      return {
        async before() {
          ({ default: SeleniumTunnel } = await mockImport(
            () => import('src/tunnels/SeleniumTunnel'),
            replace => {
              replace(() => import('src/common'))
                .transparently()
                .with({
                  global: {
                    process: mockProcess
                  }
                });
              replace(() => import('src/tunnels/webdrivers.json')).with(
                mockData
              );
            }
          ));
        },

        tests: {
          async 'bad url'() {
            tunnel = new SeleniumTunnel({
              directory: mkdtempSync(join(tmpdir(), 'intern-test')),
              drivers: [{ browserName: 'chrome' }, { browserName: 'firefox' }]
            });

            const resp = await request(tunnel.webDriverDataUrl!);
            const data = await resp.json<typeof webdriversJson>();

            tunnel.webDriverDataUrl = '/foo';
            await tunnel.download();

            const chromedriverVersion = mockData.drivers.chrome.latest;
            const chromdriver = join(
              tunnel.directory,
              chromedriverVersion,
              process.arch,
              'chromedriver'
            );
            const cdResult = execSync(`"${chromdriver}" --version`).toString(
              'utf-8'
            );
            assert.match(
              cdResult,
              new RegExp(`ChromeDriver ${chromedriverVersion}.`),
              'unexpected driver version'
            );

            const geckodriverVersion = data.drivers.firefox.latest;
            const geckodriver = join(
              tunnel.directory,
              geckodriverVersion,
              process.arch,
              'geckodriver'
            );
            const result = execSync(`"${geckodriver}" --version`).toString(
              'utf-8'
            );
            assert.match(
              result,
              new RegExp(geckodriverVersion),
              'unexpected driver version'
            );

            const dataFile = join(tunnel.directory, 'webdrivers.json');
            assert.isFalse(
              existsSync(dataFile),
              `did not expect ${dataFile} to exist`
            );
          },

          async 'good url'() {
            tunnel = new SeleniumTunnel({
              directory: mkdtempSync(join(tmpdir(), 'intern-test')),
              drivers: [{ browserName: 'chrome' }, { browserName: 'firefox' }]
            });

            const resp = await request(tunnel.webDriverDataUrl!);
            const data = await resp.json<typeof webdriversJson>();

            await tunnel.download();

            const chromedriverVersion = mockData.drivers.chrome.latest;
            const chromdriver = join(
              tunnel.directory,
              chromedriverVersion,
              process.arch,
              'chromedriver'
            );
            const cdResult = execSync(`"${chromdriver}" --version`).toString(
              'utf-8'
            );
            assert.match(
              cdResult,
              new RegExp(`ChromeDriver ${chromedriverVersion}.`),
              'unexpected driver version'
            );

            const geckodriverVersion = data.drivers.firefox.latest;
            const geckodriver = join(
              tunnel.directory,
              geckodriverVersion,
              process.arch,
              'geckodriver'
            );
            const result = execSync(`"${geckodriver}" --version`).toString(
              'utf-8'
            );
            assert.match(
              result,
              new RegExp(geckodriverVersion),
              'unexpected driver version'
            );

            const dataFile = join(tunnel.directory, 'webdrivers.json');
            assert.isTrue(
              existsSync(dataFile),
              `expected ${dataFile} to exist`
            );
          }
        }
      };
    })()
  }
};

registerSuite('integration/tunnels/SeleniumTunnel', suite);
