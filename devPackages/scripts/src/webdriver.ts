import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import SeleniumTunnel from '@theintern/digdug/dist/SeleniumTunnel';
import type webdriversJson from '@theintern/digdug/dist/webdrivers.json';
import { ask, init, isVersion, print, stop } from './lib/rl';

const projectRoot = resolve(__dirname, '..');
process.chdir(projectRoot);

const webdriversJsonFile = require.resolve(
  '@theintern/digdug/src/webdrivers.json'
);

type WebDriverData = typeof webdriversJson;

function loadWebdriverJson(): WebDriverData {
  const data = readFileSync(webdriversJsonFile, {
    encoding: 'utf8'
  });
  return JSON.parse(data);
}

function saveWebdriverJson(data: WebDriverData): void {
  writeFileSync(webdriversJsonFile, JSON.stringify(data, null, '  '));
}

async function verifyDrivers(data: WebDriverData) {
  const tunnel = new SeleniumTunnel({
    drivers: [
      { browserName: 'chrome', version: data.drivers.chrome.latest },
      { browserName: 'firefox', version: data.drivers.firefox.latest },
      {
        browserName: 'edgeChromium',
        version: data.drivers.edgeChromium.latest
      },
      { browserName: 'ie', version: data.drivers.ie.latest }
    ]
  });

  await tunnel.download(true);
}

async function main() {
  const webdrivers = loadWebdriverJson();
  const updated: WebDriverData = JSON.parse(JSON.stringify(webdrivers));

  init();

  print(
    'This script will ask for the current versions of drivers and generate an'
  );
  print('updated webdriver.json file.');
  print();
  print('Driver information can be found in the following locations:');
  print('  Selenium and IEDriverServer:');
  print('    https://selenium.dev/downloads');
  print();
  print('  chromedriver:');
  print('    https://chromedriver.chromium.org/home');
  print();
  print('  geckodriver:');
  print('    https://github.com/mozilla/geckodriver/releases');
  print();
  print('  edgedriver:');
  print(
    '    https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver'
  );
  print();

  const commands: {
    [key: string]: {
      name: string;
      property: keyof WebDriverData['drivers'];
    };
  } = {
    '1': { name: 'Selenium', property: 'selenium' },
    '2': { name: 'chromedriver', property: 'chrome' },
    '3': { name: 'geckodriver', property: 'firefox' },
    '4': { name: 'iedriver', property: 'ie' },
    '5': { name: 'edgedriver', property: 'edgeChromium' }
  };

  for (;;) {
    const modified = JSON.stringify(webdrivers) !== JSON.stringify(updated);

    for (const key in commands) {
      print(
        `${key}. ${commands[key].name}: ${
          webdrivers.drivers[commands[key].property].latest
        }`
      );
    }
    if (modified) {
      print('s. save');
    }
    print('q. quit');
    print();
    const resp = await ask('> ');

    if (Object.keys(commands).indexOf(resp) !== -1) {
      const prop = commands[resp].property;
      webdrivers.drivers[prop].latest = await ask(
        `Latest ${commands[resp].name} version: `,
        isVersion
      );
    } else if (resp === 's') {
      try {
        print('Verifying drivers...');
        await verifyDrivers(webdrivers);
        print('Everything seems good');

        saveWebdriverJson(webdrivers);
        print('Updated webdrivers.json');
      } catch (error) {
        console.error(error);
      }
    } else if (resp === 'q') {
      return;
    } else {
      print('Invalid command');
    }

    print();
  }
}

main()
  .catch(error => console.error(error))
  .finally(() => stop())
  .finally(() => print('Done'));
