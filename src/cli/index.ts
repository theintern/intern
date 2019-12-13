#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import { createInterface } from 'readline';
import { watch } from 'chokidar';

import intern from '../core';
import {
  collect,
  die,
  enumArg,
  getLogger,
  intArg,
  print,
  readJsonFile
} from './lib/util';
import { getConfig, getPackagePath } from '../core/lib/node/util';
import { defaultConfig, getConfigDescription } from '../core/lib/common/util';

function getConfigFile(cfg: string) {
  return (/@/.test(cfg) && cfg.split('@')[0]) || defaultConfig;
}

const pkgPath = getPackagePath();

const pkg = JSON.parse(
  readFileSync(join(pkgPath, 'package.json'), { encoding: 'utf8' })
);
const testsDir = 'tests';
const browsers = {
  chrome: {
    name: 'Chrome'
  },
  firefox: {
    name: 'Firefox 47+'
  },
  safari: {
    name: 'Safari',
    note:
      'Note that Safari currently requires that the Safari WebDriver ' +
      'extension be manually installed.'
  },
  'internet explorer': {
    name: 'Internet Explorer'
  },
  microsoftedge: {
    name: 'Microsft Edge'
  }
};
const nodeReporters = [
  'pretty',
  'simple',
  'runner',
  'benchmark',
  'junit',
  'jsoncoverage',
  'htmlcoverage',
  'lcov',
  'cobertura',
  'teamcity'
];
const browserReporters = ['html', 'dom', 'console'];
const tunnels = ['null', 'selenium', 'saucelabs', 'browserstack', 'cbt'];

let vlog = getLogger();
let configName = defaultConfig;

process.on('unhandledRejection', reason => {
  console.error(reason);
  process.exit(1);
});

const program = new Command();

program
  .version(pkg.version)
  .description('Run JavaScript tests.')
  .option('-v, --verbose', 'show more information about what Intern is doing')
  .option(
    '-c, --config <file>[@config]',
    `config file to use (default is ${configName})`
  );

program.on('option:verbose', () => {
  vlog = getLogger(true);
});

program.on('option:config', value => {
  configName = value;
});

program
  .command('version')
  .description('Show intern version')
  .action(() => {
    print(pkg.version);
  });

// Add a blank line after help
program.on('--help', () => {
  print();
});

program
  .command('init')
  .description('Setup a project for testing with Intern')
  .option(
    '-b, --browser <browser>',
    'browser to use for functional tests',
    (val: string) => enumArg(Object.keys(browsers), val),
    'chrome'
  )
  .on('--help', function() {
    print();
    print([
      `This command creates a "${testsDir}" directory with a ` +
        'default Intern config file and some sample tests.',
      '',
      'Browser names:',
      '',
      `  ${Object.keys(browsers).join(', ')}`,
      ''
    ]);
  })
  .action(async options => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    if (!existsSync(testsDir)) {
      try {
        mkdirSync(testsDir);
        vlog('Created test directory %s/', testsDir);
      } catch (error) {
        die('error creating test directory: ' + error);
      }
    }

    try {
      let data: any;

      // TODO should this also deal with extended configs?
      const configFile = getConfigFile(configName);
      if (existsSync(configFile)) {
        data = readJsonFile(configFile);
      } else {
        data = {};
      }

      const testsGlob = join(testsDir, '**', '*.js');
      const resources = {
        suites: [testsGlob],
        functionalSuites: <string[] | undefined>undefined,
        environments: <any>undefined
      };

      if (existsSync(join(testsDir, 'functional'))) {
        const functionalGlob = join(testsDir, 'functional', '**', '*.js');

        resources.suites.push(`!${functionalGlob}`);
        resources.functionalSuites = [functionalGlob];
        resources.environments = [{ browserName: options.browser }];
      }

      const names: (keyof typeof resources)[] = [
        'suites',
        'functionalSuites',
        'environments'
      ];
      for (const name of names) {
        if (await shouldUpdate(name, resources, data)) {
          data[name] = resources[name];
        }
      }

      vlog('Using browser: %s', options.browser);
      vlog('Saved config to %s', configFile);

      writeFileSync(configFile, `${JSON.stringify(data, null, '\t')}\n`);

      print();
      print([
        'Intern initialized! A test directory containing example unit ' +
          `and functional tests has been created at ${testsDir}/.` +
          ` See ${configFile} for configuration options.`,
        '',
        'Run the sample unit test with `intern run`.',
        '',
        'To run the sample functional test, first start a WebDriver ' +
          'server (e.g., Selenium), then run `intern run -w`. The ' +
          `functional tests assume ${options.browser} is installed.`,
        ''
      ]);
    } catch (error) {
      die('error initializing: ' + error);
    } finally {
      rl.close();
    }

    async function shouldUpdate(name: string, resources: any, data: any) {
      if (!(name in resources)) {
        return false;
      }

      if (!(name in data)) {
        return true;
      }

      if (JSON.stringify(resources[name]) === JSON.stringify(data[name])) {
        return false;
      }

      let answer = await new Promise<string>(resolve => {
        print();
        print([
          'The existing config file has the following ' + `value for ${name}:`,
          ''
        ]);
        print('  ', data[name]);
        print();
        print(['The default value based on our project layout is:', '']);
        print('  ', resources[name]);
        rl.question('\n  Should the default be used? ', resolve);
      });

      if (answer.toLowerCase()[0] !== 'y') {
        return false;
      }

      return true;
    }
  });

program
  .command('run [args...]')
  .description('Run tests in Node or in a browser using WebDriver')
  .option('-b, --bail', 'quit after the first failing test')
  .option('-C, --no-coverage', 'disable code coverage')
  .option('-g, --grep <regex>', 'filter tests by ID')
  .option(
    '-l, --leave-remote-open',
    'leave the remote browser open after tests finish'
  )
  .option('-p, --port <port>', 'port that test proxy should serve on', intArg)
  .option('--debug', 'enable the Node debugger')
  .option('--serve-only', "start Intern's test server, but don't run any tests")
  .option('--show-config', 'display the resolved config and exit')
  .option('--timeout <int>', 'set the default timeout for async tests', intArg)
  .option('--tunnel <name>', 'use the given tunnel for WebDriver tests')
  .option('-w, --webdriver', 'run WebDriver tests only')
  .option(
    '-f, --fsuites <file|glob>',
    'specify a functional suite to run (can be used multiple times)',
    collect
  )
  .option(
    '-r, --reporters <name>',
    'specify a reporter (can be used multiple times)',
    collect
  )
  .option(
    '-s, --suites <file|glob>',
    'specify a suite to run (can be used multiple times)',
    collect
  )
  .option('--no-suites', 'clear any configured suites')
  .option('--no-fsuites', 'clear any configured functional suites')
  .option('-n, --node', 'only run Node-based unit tests')
  .on('--help', () => {
    print('\n');
    print([
      'Node reporters:',
      '',
      `  ${nodeReporters.join(', ')}`,
      '',
      'Browser reporters:',
      '',
      `  ${browserReporters.join(', ')}`,
      '',
      'Tunnels:',
      '',
      `  ${tunnels.join(', ')}`
    ]);
    print();
  })
  .action(async (_args, command) => {
    // Use getConfig's argv form so that it won't try to parse the actual argv,
    // which we're handling here
    const { config } = await getConfig(['', '', `config=${configName}`]);

    if (command.showConfig) {
      config.showConfig = true;
    }

    if (command.suites != null) {
      config.suites = command.suites;
      if (config.node) {
        config.node.suites = null;
      }
      if (config.browser) {
        config.browser.suites = null;
      }
    }

    if (command.fsuites != null) {
      config.functionalSuites = command.fsuites;
    }

    if (command.reporters != null) {
      config.reporters = command.reporters;
    } else if (!config.reporters) {
      config.reporters = ['runner'];
    }

    if (command.grep != null) {
      config.grep = command.grep;
    }

    if (command.bail) {
      config.bail = true;
    }

    if (command.port != null) {
      config.port = command.port;
    }

    if (command.timeout != null) {
      config.timeout = command.timeout;
    }

    if (command.tunnel != null) {
      config.tunnel = command.tunnel;
    }

    if (command.coverage === false) {
      config.coverage = false;
    }

    if (command.leaveRemoteOpen) {
      config.leaveRemoteOpen = true;
    }

    if (command.node != null) {
      config.environments = ['node'];
    }

    if (command.webdriver) {
      // Clear out any node or general suites
      config.suites = [];
      config.browser = {
        suites: []
      };

      // If the user provided suites, apply them only to the browser
      // environment
      if (command.suites) {
        config.browser.suites.push(...command.suites);
      }

      // If the config had general suites, move them to the browser
      // environment
      if (config.suites) {
        config.browser.suites.push(...config.suites);
      }
    }

    if (command.node && command.webdriver) {
      die('Only one of --node and --webdriver may be specified');
    }

    // 'verbose' is a top-level option
    if (command.parent.verbose) {
      config.debug = true;
    }

    intern.configure(config);

    try {
      await intern.run();
    } catch (error) {
      if (!error.reported) {
        try {
          console.error(intern.formatError(error));
        } catch (e) {
          console.error(error);
        }
      }
      global.process.exitCode = 1;
    }
  });

program
  .command('serve [args...]')
  .description(
    'Start a simple web server for running unit tests in a browser on ' +
      'your system'
  )
  .option('-C, --no-coverage', 'disable code coverage')
  .option('-o, --open', 'open the test runner URL when the server starts')
  .option('-p, --port <port>', 'port to serve on', intArg)
  .on('--help', () => {
    print('\n');
    print([
      'When running WebDriver tests, Intern runs a local server to ' +
        'serve itself and the test files to the browser(s) running the ' +
        'tests. This server can also be used instead of a dedicated web ' +
        'server such as nginx or Apache for running unit tests locally.',
      ''
    ]);
  })
  .action(async (_args, command) => {
    // Allow user-specified args in the standard intern format to be passed
    // through
    // const internArgs = args || [];
    const internConfig: { [name: string]: any } = {
      config: configName,
      serveOnly: true
    };

    if (command.port) {
      internConfig.serverPort = command.port;
    }

    if (command.coverage === false) {
      internConfig.coverage = false;
    }

    intern.configure(internConfig);
    await intern.run();
  });

// Handle any unknown commands
program.command('*', { noHelp: true }).action(command => {
  print(`Unknown command "${command.parent.args[0]}"`);
  program.outputHelp();
});

program.on('--help', () => {
  try {
    getConfig().then(({ config }) => {
      const text = getConfigDescription(config);
      if (text) {
        print([`Using config file at ${defaultConfig}:`, '']);
        print(`  ${text}`);
      } else {
        print(`Using config file at ${defaultConfig}`);
      }
    });
  } catch (error) {
    // ignore
  }
});

program
  .command('watch [files]')
  .description(
    'Watch test and app files for changes and re-run Node-based ' +
      'unit tests when files are updated'
  )
  .action(async (_files, command) => {
    const { config } = await getConfig(command.config);
    const nodeSuites = [
      ...config.suites,
      ...(config.node ? config.node.suites : [])
    ];

    const watcher = watch(nodeSuites)
      .on('ready', () => {
        print('Watching', nodeSuites);
        watcher.on('add', scheduleInternRun);
        watcher.on('change', scheduleInternRun);
      })
      .on('error', (error: Error) => {
        print('Watcher error:', error);
      });

    process.on('SIGINT', () => watcher.close());

    let timer: number;
    let suites = new Set();
    function scheduleInternRun(suite: string) {
      suites.add(suite);
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(async () => {
        suites = new Set();

        const internConfig = {
          debug: command.debug,
          environments: [],
          suites
        };

        intern.configure(internConfig);
        await intern.run();
      });
    }

    intern.configure({ environments: [] });
    await intern.run();
  });

// If no command was provided and the user didn't request help, run intern
// by default
const parsed = program.parseOptions(process.argv);
if (
  parsed.args.length < 3 &&
  !(parsed.unknown[0] === '-h' || parsed.unknown[0] === '--help')
) {
  process.argv.splice(2, 0, 'run');
}

program.parse(process.argv);
