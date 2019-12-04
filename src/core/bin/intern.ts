#!/usr/bin/env node

//
// This is the runner script used to start Intern in a Node environment.
//

import { execSync } from 'child_process';
import { join } from 'path';
import { global } from '../../common';

import { getConfig, getPackagePath } from '../lib/node/util';
import { getConfigDescription } from '../lib/common/util';
import intern from '../index';
import * as console from '../lib/common/console';

getConfig()
  .then(({ config, file }) => {
    if (config.help) {
      printHelp(config, file);
    } else if (config.showConfigs) {
      console.log(getConfigDescription(config));
    } else {
      if (!file) {
        console.warn('No config file was loaded');
      }

      intern.configure({ reporters: 'runner' });
      intern.configure(config);

      if (
        intern.environment === 'browser' &&
        ((intern.config.suites &&
          intern.config.suites.some(pattern => pattern.endsWith('.ts'))) ||
          (intern.config.plugins &&
            intern.config.plugins.some(plugin =>
              plugin.script.endsWith('.ts')
            )))
      ) {
        throw new Error(
          'Loading TypeScript files is not supported in the browser'
        );
      }
      return intern.run();
    }
  })
  .catch(error => {
    // If intern wasn't initialized, then this error won't have been
    // reported
    if (!error.reported) {
      try {
        console.error(intern.formatError(error));
      } catch (e) {
        console.error(error);
      }
    }
    global.process.exitCode = 1;
  });

function printHelp(config: any, file?: string) {
  const $ = (cmd: string) => execSync(cmd, { encoding: 'utf8' }).trim();
  const pkgPath = getPackagePath();
  const pkg = require(join(pkgPath, 'package.json'));
  const npmVersion = $('npm -v');
  const nodeVersion = $('node -v');
  console.log(`intern version ${pkg.version}`);
  console.log(`npm version ${npmVersion}`);
  console.log(`node version ${nodeVersion}`);
  console.log();
  console.log(
    'Usage: intern [config=<file>] [showConfig|showConfigs] [options]'
  );
  console.log();
  console.log('  config      - path to a config file');
  console.log('  showConfig  - show the resolved config');
  console.log('  showConfigs - show information about configFile');
  console.log();
  console.log("Options (set with 'option=value' or 'option'):\n");

  const internConfig = (<any>intern)._config;
  const opts = Object.keys(internConfig)
    .map(key => {
      return { name: key, value: JSON.stringify(internConfig[key]) };
    })
    .sort((a, b) => {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
        return 1;
      }
      return 0;
    });
  const width = opts.reduce((max, opt) => Math.max(opt.name.length, max), 0);

  for (const { name, value } of opts) {
    const pad = Array(width - name.length + 1).join(' ');
    console.log(`  ${name}${pad} - ${value}`);
  }

  if (file) {
    console.log();
    const description = getConfigDescription(config, '  ');
    if (description) {
      console.log(`Using config file '${file}':\n`);
      console.log(description);
    } else {
      console.log(`Using config file '${file}'`);
    }
  }
}
