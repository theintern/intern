#!/usr/bin/env node

import * as program from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { sync as resolve } from 'resolve';

import {
	acceptVersion,
	collect,
	die,
	enumArg,
	getLogger,
	intArg,
	print
} from '../lib/util';
import cli3, {
	minVersion as cli3Min,
	maxVersion as cli3Max
} from '../lib/cli3';
import cli4, {
	minVersion as cli4Min,
	maxVersion as cli4Max
} from '../lib/cli4';

let internDir: any;
let internPkg: any;

try {
	internDir = dirname(resolve('intern', { basedir: process.cwd() }));
	internPkg = JSON.parse(
		readFileSync(join(internDir, 'package.json'), { encoding: 'utf8' })
	);
} catch (error) {
	die([
		'You will need a local install of Intern before you can use this ' +
			'command. Install it with',
		'',
		'  npm install --save-dev intern'
	]);
}

const pkg = require('../../../package.json');
const minVersion = '3.0.0';
const testsDir = 'tests';
const commands: { [name: string]: program.ICommand } = Object.create(null);
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

let vlog = getLogger();

program
	.version(pkg.version)
	.description('Run JavaScript tests')
	.option(
		'-v, --verbose',
		'show more information about what Intern is doing'
	);

program.on('option:verbose', () => {
	vlog = getLogger(true);
});

program
	.command('version')
	.description('Show versions of intern-cli and intern')
	.on('--help', () => {
		print();
	})
	.action(() => {
		const text = [`intern-cli: ${pkg.version}`];
		if (internDir) {
			text.push(`intern: ${internPkg.version}`);
		}
		print(['', ...text, '']);
	});

// Add a blank line after help
program.on('--help', () => {
	print();
});

commands.help = program
	.command('help [command]')
	.description('Get help for a command')
	.action(commandName => {
		const cmdName = typeof commandName === 'string' ? commandName : '';
		const commands: any[] = (<any>program).commands;
		const command = commands.find(cmd => cmd.name() === cmdName);

		if (command) {
			command.outputHelp();
		} else {
			print();

			if (cmdName) {
				print(`unknown command: ${cmdName}\n`);
			}

			print(
				'To get started with Intern, run `intern init` to setup a ' +
					`"${testsDir}" directory and then ` +
					'run `intern run` to start testing!'
			);
			program.outputHelp();
		}
	});

commands.init = program
	.command('init')
	.description('Setup a project for testing with Intern')
	.option(
		'-b, --browser <browser>',
		'browser to use for functional tests',
		(val: string) => enumArg(Object.keys(browsers), val),
		'chrome'
	)
	.on('--help', function() {
		print([
			'\n',
			`This command creates a "${testsDir}" directory with a ` +
				'default Intern config file and some sample tests.',
			'',
			'Browser names:',
			'',
			`  ${Object.keys(browsers).join(', ')}`,
			''
		]);
	});

commands.run = program
	.command('run')
	.description('Run tests in Node or in a browser using WebDriver')
	.option('-b, --bail', 'quit after the first failing test')
	.option(
		'-c, --config <module ID|file>',
		`config file to use (default is ${testsDir}/intern.js)`
	)
	.option(
		'-f, --fsuites <module ID>',
		'specify a functional suite to run (can be used multiple times)',
		collect,
		[]
	)
	.option('-g, --grep <regex>', 'filter tests by ID')
	.option(
		'-l, --leaveRemoteOpen',
		'leave the remote browser open after tests finish'
	)
	.option(
		'-r, --reporters <name|module ID>',
		'specify a reporter (can be used multiple times)',
		collect,
		[]
	)
	.option('-p, --port <port>', 'port that test proxy should serve on', intArg)
	.option(
		'-s, --suites <module ID>',
		'specify a suite to run (can be used multiple times)',
		collect,
		[]
	)
	.option(
		'-w, --webdriver',
		'use the WebDriver runner (default is Node client)'
	)
	.option('-I, --noInstrument', 'disable instrumentation')
	.option('--debug', 'enable the Node debugger')
	.option(
		'--serveOnly',
		"start Intern's test server, but don't run any tests"
	)
	.option(
		'--timeout <int>',
		'set the default timeout for async tests',
		intArg
	)
	.option('--tunnel <name>', 'use the given tunnel for WebDriver tests');

commands.serve = program
	.command('serve')
	.description(
		'Start a simple web server for running unit tests in a browser on ' +
			'your system'
	)
	.option(
		'-c, --config <module ID|file>',
		`config file to use (default is ${testsDir}/intern.js)`
	)
	.option('-o, --open', 'open the test runner URL when the server starts')
	.option('-p, --port <port>', 'port to serve on', intArg)
	.option('-I, --noInstrument', 'disable instrumentation')
	.on('--help', () => print());

// Handle any unknown commands
commands['*'] = program
	.command('*', undefined, { noHelp: true })
	.action(command => {
		die(`unknown command: ${command}`);
	});

const context = { browsers, commands, program, vlog, internDir, testsDir };

if (acceptVersion(internPkg.version, cli3Min, cli3Max)) {
	cli3(context);
} else if (acceptVersion(internPkg.version, cli4Min, cli4Max)) {
	cli4(context);
} else {
	die(
		`This command requires Intern ${minVersion} or newer (` +
			`${internPkg.version} is installed).`
	);
}

program.parse(process.argv);

// If no command was given, show the help message
if (process.argv.length === 2) {
	program.outputHelp();
}
