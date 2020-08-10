import { watch } from 'chokidar';
import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { parse } from 'shell-quote';

import {
  Args,
  Config,
  DEFAULT_CONFIG,
  parseArgs
} from '@theintern/core/dist/lib/config';
import { createConfigurator } from '@theintern/core/dist/lib/node';
import intern from '@theintern/core';
import { Events } from '@theintern/core/dist/lib/executors/Executor';
import {
  collect,
  die,
  enumArg,
  getLogger,
  getPackagePath,
  intArg,
  print,
  readJsonFile,
  showConfig
} from './lib/util';

function getConfigFile(cfg: string) {
  return (/@/.test(cfg) && cfg.split('@')[0]) || DEFAULT_CONFIG;
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
let configName = DEFAULT_CONFIG;

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
    '-c, --config [file][@config]',
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

program
  .command('init')
  .description('Setup a project for testing with Intern')
  .option(
    '-b, --browser <browser>',
    'browser to use for functional tests',
    (val: string) => enumArg(Object.keys(browsers), val),
    'chrome'
  )
  .on('--help', function () {
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

      const answer = await new Promise<string>(resolve => {
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
  .command('describe')
  .description('Describe a config file')
  .action(async () => {
    try {
      const configurator = createConfigurator();
      const text = await configurator.describeConfig(configName);
      print([`Using config file at ${configName}:`, '']);
      print(`  ${text}`);
    } catch (error) {
      vlog(error);
      die(`ERROR: ${error.message}`);
    }
    print();
  });

program
  .command('run [args...]')
  .description('Run tests in Node or in a browser using WebDriver')
  .option('-b, --bail', 'quit after the first failing test')
  .option('-C, --no-coverage', 'disable code coverage')
  .option(
    '-e, --environments <environment>',
    'specify an environment to run tests in',
    collect
  )
  .option('-g, --grep <regex>', 'filter tests by ID')
  .option(
    '-l, --leave-remote-open',
    'leave the remote browser open after tests finish'
  )
  .option('-p, --port <port>', 'port that test proxy should serve on', intArg)
  .option('--debug', 'enable debug logging')
  .option('--serve-only', "start Intern's test server, but don't run any tests")
  .option('--show-config [property]', 'display the resolved config and exit')
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
    const config: Args = process.env['INTERN_ARGS']
      ? parseArgs(parse(process.env['INTERN_ARGS']) as string[])
      : {};

    if (command.showConfigs) {
      try {
        const configurator = createConfigurator({
          eventEmitter: {
            emit: (event: keyof Events, data?: any) => {
              vlog(`${event}: ${data}`);
              return Promise.resolve();
            }
          }
        });
        const text = await configurator.describeConfig(configName);
        console.log(`\n${text}\n`);
        return;
      } catch (error) {
        vlog(error);
        die(`ERROR: ${error.message}`);
      }
    }

    try {
      // Will load a user-specified config or the default
      intern.configure({ reporters: ['runner'] });
      await intern.loadConfig(configName);
    } catch (error) {
      vlog(error);
      die(`ERROR: ${error.message}`);
    }

    if (command.suites != null) {
      config.suites = command.suites;
      config['node+'] = {
        suites: []
      };
      config['browser+'] = {
        suites: []
      };
    }

    if (command.fsuites != null) {
      config.functionalSuites = command.fsuites;
    }

    if (command.reporters != null) {
      config.reporters = command.reporters;
    }

    if (command.grep != null) {
      config.grep = command.grep;
    }

    if (command.bail) {
      config.bail = true;
    }

    if (command.environments) {
      config.environments = command.environments;
    }

    if (command.port != null) {
      config.serverPort = command.port;
    }

    if (command.serveOnly != null) {
      config.serveOnly = true;
    }

    if (command.timeout != null) {
      config.defaultTimeout = command.timeout;
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

    // 'verbose' is a top-level option
    if (command.parent.verbose || command.debug) {
      config.debug = true;
    }

    try {
      intern.configure(config);
    } catch (error) {
      console.error(error);
      global.process.exitCode = 1;
      return;
    }

    try {
      if (command.showConfig) {
        showConfig(command.showConfig);
      } else {
        await intern.run();
      }
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
  .option('--debug', 'enable debug logging')
  .option('-o, --open', 'open the test runner URL when the server starts')
  .option('-p, --port <port>', 'port to serve on', intArg)
  .option(
    '-s, --socket-port <port>',
    'port to serve WebSocket connections on',
    intArg
  )
  .option('--show-config [property]', 'display the resolved config and exit')
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

    try {
      // Will load a user-specified config or the default
      await intern.loadConfig(configName);
    } catch (error) {
      vlog(error);
      die(`ERROR: ${error.message}`);
    }

    const config: Args = { serveOnly: true };

    // 'verbose' is a top-level option
    if (command.parent.verbose || command.debug) {
      config.debug = true;
    }

    if (command.port) {
      config.serverPort = command.port;
    }

    if (command.socketPort) {
      config.socketPort = command.socketPort;
    }

    if (command.coverage === false) {
      config.coverage = false;
    }

    intern.configure(config);

    if (command.showConfig) {
      showConfig(command.showConfig);
    } else {
      await intern.run();
    }
  });

// Handle any unknown commands
program.command('*', { noHelp: true }).action(command => {
  print(`Unknown command "${command.parent.args[0]}"`);
  program.outputHelp();
});

program
  .command('watch [files]')
  .description(
    'Watch test and app files for changes and re-run Node-based ' +
      'unit tests when files are updated'
  )
  .action(async (_files, command) => {
    const configurator = createConfigurator();
    const config = await configurator.loadConfig(command.config);
    const nodeSuites = [
      ...(config.suites || []),
      ...(config.node && config.node.suites ? config.node.suites : [])
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

    process.on('SIGINT', () => {
      watcher.close();
    });

    let timer: number;
    let suites = new Set<string>();
    function scheduleInternRun(suite: string) {
      suites.add(suite);
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(async () => {
        suites = new Set();

        const internConfig: Partial<Config> = {
          debug: command.debug,
          environments: [],
          suites: Array.from(suites)
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
  parsed.operands.length < 3 &&
  !(parsed.unknown[0] === '-h' || parsed.unknown[0] === '--help')
) {
  process.argv.splice(2, 0, 'run');
}

(async () => {
  await program.parseAsync(process.argv);
})();
