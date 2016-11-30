#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as cli from '../lib/cli';
import { Command } from 'commander';
import * as resolve from 'resolve';
import { spawn } from 'child_process';
import opn = require('opn');
const pkg = require('../../../package.json');

const program = new Command();

let vlog = cli.getLogger();
const print = cli.print;
const die = cli.die;

let internDir: string;
let internPackage: any;

const TESTS_DIR = 'tests';
const MIN_VERSION = '3.0.0';
const BROWSERS = {
	'chrome': {
		name: 'Chrome',
		driver: 'ChromeDriver',
		url: 'https://github.com/SeleniumHQ/selenium/wiki/ChromeDriver'
	},
	'firefox': {
		environment: { marionette: true },
		name: 'Firefox 47+',
		driver: 'GeckoDriver',
		url: 'https://developer.mozilla.org/en-US/docs/Mozilla/QA/Marionette/WebDriver'
	},
	'safari': {
		note: 'Note that Safari currently requires that the Safari WebDriver extension be manually ' +
			'installed.',
		name: 'Safari',
		driver: 'SafariDriver',
		url: 'https://github.com/SeleniumHQ/selenium/wiki/SafariDriver'
	},
	'internet explorer': {
		name: 'Internet Explorer',
		driver: 'IEDriverServer',
		url: 'https://github.com/SeleniumHQ/selenium/wiki/InternetExplorerDriver'
	},
	'microsoftedge': {
		name: 'Microsft Edge',
		driver: 'MicrosoftWebDriver',
		url: 'https://developer.microsoft.com/en-us/microsoft-edge/platform/documentation/dev-guide' +
			'/tools/webdriver/'
	}
};

// Load the local Intern's package.json
try {
	internDir = path.dirname(resolve.sync('intern', { basedir: process.cwd() }));
	internPackage = JSON.parse(fs.readFileSync(path.join(internDir, 'package.json'), { encoding: 'utf8' }));
}
catch (error) {
	die([
		'You\'ll need a local install of Intern before you can use this command. Install it with',
		'',
		'  npm install --save-dev intern'
	]);
}

// Verify the installed Intern is a version this script can work with
if (!cli.acceptVersion(internPackage.version, MIN_VERSION)) {
	die('This command requires Intern ' + MIN_VERSION + ' or newer (' + internPackage.version +
		' is installed).');
}

// Override commander's helpInformation to show the description above commands. Remove this if
// https://github.com/tj/commander.js/issues/500 gets taken care of.
program.helpInformation = function(this: any) {
	let desc: string[] = [];
	if (this._description) {
		desc = [
			'',
			'  ' + this._description
		];
	}

	let cmdName = this._name;
	if (this._alias) {
		cmdName = `${cmdName}|${this._alias}`;
	}
	const usage = [
		'',
		`  Usage: ${cmdName} ${this.usage()}`
	];

	const cmds: string[] = [];
	const commandHelp = this.commandHelp();
	if (commandHelp) {
		cmds.push(commandHelp);
	}

	const options = [
		'  Options:',
		'',
		'' + this.optionHelp().replace(/^/gm, '    '),
		'',
		''
	];

	return usage
		.concat(desc)
		.concat(cmds)
		.concat(options)
		.join('\n');
};

program
	.description('Run JavaScript tests')
	.option('-v, --verbose', 'show more information about what Intern is doing')
	.option('-V, --version', 'output the version')
	.on('version', function () {
		print();
		print('intern-cli: ' + pkg.version);
		if (internDir) {
			print('intern: ' + internPackage.version);
		}
		print();
	})
	.on('verbose', function () {
		vlog = cli.getLogger(true);
	})
	.on('help', function (args: any[]) {
		const commandName = args[0];
		let command: any;
		const commands: any[] = (<any> program).commands;

		for (let i = 0; i < commands.length; i++) {
			if (commands[i].name() === commandName) {
				command = commands[i];
			}
		}

		if (command) {
			command.help();
		}
		else {
			print();

			if (commandName) {
				print('unknown command: ' + commandName + '\n');
			}

			print([
				'To get started with Intern, run `intern init` to setup a "' + TESTS_DIR + '" directory and then',
				'run `intern run` to start testing!'
			]);
			program.help();
		}

		print();
	});

program
	.command('init')
	.description('Setup a project for testing with Intern')
	.option('-b, --browser <browser>', 'browser to use for functional tests',
		cli.enumArg.bind(null, Object.keys(BROWSERS)), 'chrome')
	.action(function (options) {
		// jshint maxcomplexity:11
		try {
			fs.statSync(TESTS_DIR);
			die('error: A file or directory named "' + TESTS_DIR + '" already exists.');
		}
		catch (error) {
			// ignore
		}

		try {
			fs.mkdirSync(TESTS_DIR);

			vlog('Created test directory %s/', TESTS_DIR);

			const configFile = path.join(TESTS_DIR, 'intern.js');

			let data = fs.readFileSync(path.join(internDir, 'tests', 'example.intern.js'), { encoding: 'utf8' });
			data = data.replace(/myPackage/g, 'app');
			data = data.replace(/suites: \[.*?],/, 'suites: [ \'app/tests/unit/*\' ],');
			data = data.replace(/functionalSuites: \[.*?],/, 'functionalSuites: [ \'app/tests/functional/*\' ],');
			data = data.replace(/'BrowserStackTunnel'/, '\'NullTunnel\'');
			data = data.replace(/capabilities: {[\s\S]*?}/, 'capabilities: {}');

			vlog('Using browser: %s', options.browser);
			vlog('Created config file %s', configFile);

			let environment: string;
			if (options.browser === 'firefox') {
				environment = '{ browserName: \'firefox\', marionette: true }';
			}
			else {
				environment = '{ browserName: \'' + options.browser + '\' }';
			}
			data = data.replace(/environments: \[[\s\S]*?],/, 'environments: [ ' + environment + ' ],');

			fs.writeFileSync(configFile, data);

			cli.copy(path.join(__dirname, '..', '..', '..', 'init'), path.join(TESTS_DIR));

			vlog('Copied test files');

			print();
			print([
				'Intern initialized! A test directory containing example unit and functional tests has been ' +
				'created at ' + TESTS_DIR + '/. See ' + configFile + ' for configuration options.',
				'',
				'Run the sample unit test with `intern run`.',
				'',
				'To run the sample functional test, first start a WebDriver server (e.g., Selenium), then ' +
				'run `intern run -w`. The functional tests assume ' + options.browser + ' is installed.',
				''
			]);

			const info = (<any> BROWSERS)[options.browser];
			let note = info.note;

			if (!note) {
				note = 'Note that running WebDriver tests with ' + info.name + ' requires ' + info.driver +
				' to be available in the system path.';
			}

			print([
				note + ' See',
				'',
				'  ' + info.url,
				'',
				'for more information.',
				''
			]);
		}
		catch (error) {
			die('error initializing: ' + error);
		}
	})
	.on('--help', function () {
		print('This command creates a "' + TESTS_DIR + '" directory with a default Intern config file ' +
			'and some sample tests.');
		print();
		print('Browser names:');
		print();
		print('  ' + Object.keys(BROWSERS).join(', '));
		print();
	});

program
	.command('run')
	.description('Run tests in Node or in a browser using WebDriver')
	.option('-b, --bail', 'quit after the first failing test')
	.option('-c, --config <module ID|file>', 'config file to use (default is ' + TESTS_DIR + '/intern.js)')
	.option('-f, --fsuites <module ID>', 'specify a functional suite to run (can be used multiple times)', cli.collect,
		[])
	.option('-g, --grep <regex>', 'filter tests by ID')
	.option('-l, --leaveRemoteOpen', 'leave the remote browser open after tests finish')
	.option('-r, --reporters <name|module ID>', 'specify a reporter (can be used multiple times)', cli.collect, [])
	.option('-p, --port <port>', 'port that test proxy should serve on', cli.intArg)
	.option('-s, --suites <module ID>', 'specify a suite to run (can be used multiple times)', cli.collect, [])
	.option('-w, --webdriver', 'use the WebDriver runner (default is Node client)')
	.option('-I, --noInstrument', 'disable instrumentation')
	.option('--debug', 'enable the Node debugger')
	.option('--proxyOnly', 'start Intern\'s test server, but don\'t run any tests')
	.option('--timeout <int>', 'set the default timeout for async tests', cli.intArg)
	.option('--tunnel <name>', 'use the given tunnel for WebDriver tests')
	.action(function (...args: any[]) {
		// jshint maxcomplexity:12

		const options = args[args.length - 1];
		const config = options.config || path.join(TESTS_DIR, 'intern.js');

		try {
			fs.statSync(config);
		}
		catch (error) {
			die([
				'There isn\'t a test config at ' + config + '. You can specify a different test config ' +
				'with the --config option, or run `intern init` to setup a project for testing.'
			]);
		}

		const mode = options.webdriver ? 'runner' : 'client';
		const internCmd = path.join(internDir, mode);

		// Allow user-specified args in the standard intern format to be passed through
		const internArgs = args.slice(0, args.length - 1);

		internArgs.push('config=' + config);

		options.suites.forEach(function (suite: string) {
			internArgs.push('suites=' + suite);
		});

		options.fsuites.forEach(function (suite: string) {
			internArgs.push('functionalSuites=' + suite);
		});

		options.reporters.forEach(function (reporter: string) {
			internArgs.push('reporters=' + reporter);
		});

		if (options.grep) {
			internArgs.push('grep=' + options.grep);
		}

		if (options.bail) {
			internArgs.push('bail');
		}

		if (options.port) {
			internArgs.push('proxyPort=' + options.port);
		}

		if (options.timeout) {
			internArgs.push('defaultTimeout=' + options.timeout);
		}

		if (options.tunnel) {
			internArgs.push('tunnel=' + options.tunnel);
		}

		if (options.noInstrument) {
			internArgs.push('excludeInstrumentation');
		}

		if (options.leaveRemoteOpen) {
			internArgs.push('leaveRemoteOpen');
		}

		// 'verbose' is a top-level option
		if (options.parent.verbose) {
			internArgs.push('verbose');
		}

		const nodeArgs: string[] = [];

		if (options.debug) {
			nodeArgs.push('debug');
		}

		const spawnArgs = nodeArgs.concat(internCmd).concat(internArgs);

		vlog('Running %s %s', process.execPath, spawnArgs.join(' '));

		const intern = spawn(process.execPath, spawnArgs, {
			stdio: 'inherit'
		});

		process.on('SIGINT', function () {
			intern.kill('SIGINT');
		});

		intern.on('close', function (code: number, signal: string) {
			if (process.exitCode == null) {
				process.exitCode = code != null ? code : cli.exitCodeForSignal(signal);
			}
		});

		intern.on('error', function () {
			if (process.exitCode == null) {
				process.exitCode = 1;
			}
		});
	})
	.on('--help', function () {
		print([
			'Tests may be run purely in Node using the Node client, or in a browser using the WebDriver ' +
			'runner.',
			'',
			'The Node client runs tests purely in Node rather than in a browser. This makes it well ' +
			'suited for quickly running tests that do not involve the DOM, and and for testing code ' +
			'meant to run in a server environment. Only unit tests will be run when using the Node ' +
			'client.',
			'',
			'The WebDriver runner starts and controls a browser using the WebDriver protocol. This ' +
			'requires that either a local instance of Selenium is running or that Intern has been ' +
			'configured to run tests on a cloud testing service. Both unit and functional tests will ' +
			'be run when using the WebDriver runner.',
			''
		]);

		const reporters: string[] = [];
		const reporterDir = path.join(internDir, 'lib', 'reporters');
		fs.readdirSync(reporterDir).filter(function (name: string) {
			const fullPath = path.join(reporterDir, name);
			return fs.statSync(fullPath).isFile();
		}).forEach(function (name) {
			reporters.push(path.basename(name, '.js'));
		});
		print([
			'Reporters:',
			'',
			'  ' + reporters.join(', '),
			''
		]);

		const tunnels: string[] = [];
		const digdugDir = path.dirname(resolve.sync('digdug/Tunnel', { basedir: process.cwd() }));
		fs.readdirSync(digdugDir).filter(function (name) {
			return /\wTunnel/.test(name);
		}).forEach(function (name) {
			tunnels.push(path.basename(name, '.js'));
		});
		print([
			'Tunnels:',
			'',
			'  ' + tunnels.join(', '),
			''
		]);
	});

program
	.command('serve')
	.description('Start a simple web server for running unit tests in a browser on your system')
	.option('-c, --config <module ID|file>', 'config file to use (default is ' + TESTS_DIR + '/intern.js)')
	.option('-o, --open', 'open the test runner URL when the server starts')
	.option('-p, --port <port>', 'port to serve on', cli.intArg)
	.option('-I, --noInstrument', 'disable instrumentation')
	.action(function (...args: any[]) {
		const options = args[args.length - 1];
		const config = options.config || path.join(TESTS_DIR, 'intern.js');
		const internCmd = path.join(internDir, 'runner');

		// Allow user-specified args in the standard intern format to be passed through
		const internArgs = args.slice(0, args.length - 1);

		internArgs.push('config=' + config);
		internArgs.push('proxyOnly');

		if (options.port) {
			internArgs.push('proxyPort=' + options.port);
		}

		if (options.noInstrument) {
			internArgs.push('excludeInstrumentation');
		}

		const nodeArgs: string[] = [];

		if (options.debug) {
			nodeArgs.push('debug');
		}

		const intern = spawn(process.execPath, nodeArgs.concat(internCmd).concat(internArgs), {
			stdio: [ process.stdin, 'pipe', process.stdout ]
		});

		intern.stdout.on('data', function (data: any) {
			data = String(data);
			process.stdout.write(data);

			if (/Listening on/.test(data)) {
				const internPath = '/node_modules/intern/client.html?config=' + config;

				// Get the address. Convert 0.0.0.0 to 'localhost' for Windows compatibility.
				let address = data.split(' on ')[1].replace(/^\s*/, '').replace(/\s*$/, '');
				const parts = address.split(':');
				if (parts[0] === '0.0.0.0') {
					parts[0] = 'localhost';
				}
				address = parts.join(':');

				if (options.open) {
					opn('http://' + address + internPath);
				}
				else {
					print([
						'',
						'To run unit tests, browse to:',
						'',
						'  http://' + address + internPath
					]);
				}

				print();
				print('Press CTRL-C to stop serving.');
				print();
			}
		});

		process.on('SIGINT', function () {
			intern.kill('SIGINT');
		});
	})
	.on('--help', function () {
		print('When running WebDriver tests, Intern runs a local server to serve itself and the test ' +
			'files to the browser(s) running the tests. This server can also be used instead of a ' +
			'dedicated web server such as nginx or Apache for running unit tests locally.');
		print();
	});

// Handle any unknown commands
program
	.command('*', null, { noHelp: true })
	.action(function (command) {
		die('unknown command: ' + command);
	});

program.parse(process.argv);

// If no command was given, show the help message
if (process.argv.length === 2) {
	program.outputHelp();
}
