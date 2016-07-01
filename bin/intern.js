#!/usr/bin/env node

/**
 * enumArg ensures a value is part of an enum
 */
function enumArg(val, choices) {
	if (choices.indexOf(val) === -1) {
		console.error();
		console.error('  error: expected "' + val + '" to be one of {' + choices.join(', ') + '}');
		console.error();
		process.exit(1);
	}
	return val;
}

/**
 * collect collects values into an array
 */
function collect(val, arr) {
	arr.push(val);
}

/**
 * copy synchronously copies files or directories
 */
function copy(src, dst) {
	if (fs.statSync(src).isDirectory()) {
		try {
			fs.mkdirSync(dst);
		}
		catch (error) {
			if (error.code !== 'EEXIST') {
				throw error;
			}
		}

		fs.readdirSync(src).forEach(function (filename) {
			copy(path.join(src, filename), path.join(dst, filename));
		});
	}
	else {
		var data = fs.readFileSync(src);
		fs.writeFileSync(dst, data);
	}
}

/**
 * intArg ensures a value is a number and returns its int value
 */
function intArg(val) {
	if (isNaN(val)) {
		console.error();
		console.error('  error: expected "' + val + '" to be a number');
		console.error();
		process.exit(1);
	}
	return Number.parseInt(val, 10);
}

/**
 * vlog prints log messages if verbose mode is enabled
 */
function vlog() {
	if (program.verbose) {
		process.stdout.write('>> ');
		console.log.apply(console, arguments);
	}
}

var fs = require('fs');
var path = require('path');
var program = require('commander');
var internDir;
var internPackage;
var TESTS_DIR = 'tests';

// Load the local Intern's package.json
try {
	internDir = path.dirname(require('resolve').sync('intern', { basedir: process.cwd() }));
	internPackage = JSON.parse(fs.readFileSync(path.join(internDir, 'package.json'), { encoding: 'utf8' }));
}
catch (error) {
	console.log([
		'',
		'  You\'ll need a local install of Intern before you can use this command. Install it with',
		'',
		'    npm install --save-dev intern',
		''
	].join('\n'));
	process.exit(1);
}

// Verify the installed Intern is a version this script can work with
if (!require('semver').satisfies(internPackage.version.replace('-pre', ''), '>=3.0.0')) {
	console.log();
	console.error('  This command requires Intern 3.0.0 or newer (' + internPackage.version + ' is installed).');
	console.log();
	process.exit(1);
}

// Override commander's helpInformation to show the description above commands. Remove this if
// https://github.com/tj/commander.js/issues/500 gets taken care of.
program.helpInformation = function() {
	var desc = [];
	if (this._description) {
		desc = [
			'',
			'  ' + this._description,
		];
	}

	var cmdName = this._name;
	if (this._alias) {
		cmdName = cmdName + '|' + this._alias;
	}
	var usage = [
		'',
		'  Usage: ' + cmdName + ' ' + this.usage(),
	];

	var cmds = [];
	var commandHelp = this.commandHelp();
	if (commandHelp) {
		cmds = [commandHelp];
	}

	var options = [
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
	.option('--debug', 'enable the Node debugger')
	.on('version', function () {
		console.log();
		console.log('  intern-cli: ' + require('../package.json').version);
		if (internDir) {
			console.log('  intern: ' + internPackage.version);
		}
		console.log();
	})
	.on('help', function (args) {
		var commandName = args[0];
		var command;

		for (var i = 0; i < program.commands.length; i++) {
			if (program.commands[i].name() === commandName) {
				command = program.commands[i];
			}
		}

		if (command) {
			command.help();
		}
		else {
			console.log();

			if (commandName) {
				console.log('  unknown command: ' + commandName + '\n');
			}

			console.log([
				'  To get started with Intern, run `intern init` to setup a "' + TESTS_DIR + '" directory and then',
				'  run `intern run` to start testing!'
			].join('\n'));
			program.help();
		}

		console.log();
	});

program 
	.command('init')
	.description('Setup a project for testing with Intern')
	.option('-b, --browser <browser>', 'browser to use for functional tests',
		enumArg, [ 'chrome', 'firefox', 'safari', 'internet explorer' ])
	.action(function (options) {
		try {
			fs.statSync(TESTS_DIR);
			console.log();
			console.error('  error: A file or directory named "' + TESTS_DIR + '" already exists.');
			console.log();
			process.exit(1);
		}
		catch (error) {
			// ignore
		}

		if (options.browser === null) {
			console.error();
			console.error('  error: Browser must be one of "chrome", "firefox", "safari", or "internet explorer"');
			console.error();

		}

		try {
			vlog('Creating %s...', TESTS_DIR);

			fs.mkdirSync(TESTS_DIR);

			var configFile = path.join(TESTS_DIR, 'intern.js');

			vlog('Creating %s...', configFile);

			var data = fs.readFileSync(path.join(internDir, 'tests', 'example.intern.js'), { encoding: 'utf8' });
			data = data.replace(/myPackage/g, 'app');
			data = data.replace(/suites: \[.*?],/, 'suites: [ \'app/tests/unit/*\' ],');
			data = data.replace(/'BrowserStackTunnel'/, '\'NullTunnel\'');
			data = data.replace(/capabilities: {[\s\S]*?}/, 'capabilities: {}');
			data = data.replace(/environments: \[[\s\S]*?],/, 'environments: [ { browserName: \'' + options.browser +
				'\' } ],');
			fs.writeFileSync(configFile, data);

			vlog('Copying test files...');
			copy(path.join(__dirname, '..', 'init'), path.join(TESTS_DIR));

			console.log();
			console.log([
				'  Intern initialized! See ' + configFile + ' for configuration options.  Run the sample',
				'  unit test with `intern run`.',
				'',
				'  To run the sample functional test, first start a WebDriver server (e.g., Selenium), then',
				'  run `intern run -w`. The functional tests assume ' + options.browser + ' is installed.',
				''
			].join('\n'));
		}
		catch (error) {
			console.log();
			console.error('  error initializing: ' + error);
			console.log();
			process.exit(1);
		}
	})
	.on('--help', function () {
		console.log('  Creates a "' + TESTS_DIR + '" directory with a default Intern config file.');
		console.log();
	});

program 
	.command('run')
	.description('Run tests in Node or in a browser using WebDriver')
	.option('-b, --bail', 'quit after the first failing test')
	.option('-c, --config <module ID|file>', 'config file to use (default is ' + TESTS_DIR + '/intern.js)')
	.option('-g, --grep <regex>', 'filter tests by ID')
	.option('-l, --leaveRemoteOpen', 'leave the remote browser open after tests finish')
	.option('-r, --reporters <name|module ID>', 'specify a reporter (can be used multiple times)', collect, [])
	.option('-s, --suites <module ID>', 'specify a suite to run (can be used multiple times)', collect, [])
	.option('-w, --webdriver', 'use the WebDriver runner (default is Node client)')
	.option('-I, --noInstrument', 'disable instrumentation')
	.option('--proxyOnly', 'start Intern\'s test server, but don\'t run any tests')
	.option('--timeout <int>', 'set the default timeout for async tests', intArg)
	.option('--tunnel <name>', 'use the given tunnel for WebDriver tests')
	.action(function (options) {
		//jshint maxcomplexity:11

		var config = options.config || path.join(TESTS_DIR, 'intern.js');

		try {
			fs.statSync(config);
		}
		catch (error) {
			console.error([
				'',
				'  There isn\'t a test config at ' + config + '. You can specify a different test config',
				'  with the --config option, or run `intern init` to setup a project for testing.',
				''
			].join('\n'));
			process.exit(1);
		}

		var mode = options.webdriver ? 'runner' : 'client';
		var internCmd = path.join(internDir, mode);
		var internArgs = [ 'config=' + config ];

		options.suites.forEach(function (suite) {
			internArgs.push('suites=' + suite);
		});

		options.reporters.forEach(function (reporter) {
			internArgs.push('reporters=' + reporter);
		});

		if (options.grep) {
			internArgs.push('grep=' + program.grep);
		}

		if (options.bail) {
			internArgs.push('bail');
		}

		if (options.timeout) {
			internArgs.push('defaultTimeout=' + program.timeout);
		}

		if (options.tunnel) {
			internArgs.push('tunnel=' + program.tunnel);
		}

		if (options.noInstrument) {
			internArgs.push('excludeInstrumentation');
		}

		if (options.leaveRemoteOpen) {
			internArgs.push('leaveRemoteOpen');
		}

		var nodeArgs = [];

		if (options.debug) {
			nodeArgs.push('--debug');
		}

		var spawnArgs = nodeArgs.concat(internCmd).concat(internArgs);

		vlog('Running %s %s', process.execPath, spawnArgs.join(' '));

		var spawn = require('child_process').spawn;
		var intern = spawn(process.execPath, spawnArgs, {
			stdio: 'inherit'
		});

		process.on('SIGINT', function () {
			intern.kill('SIGINT');
		});
	})
	.on('--help', function () {
		console.log([
			'  Tests may be run purely in Node using the Node client, or in a browser using the WebDriver',
			'  runner.',
			'',
			'  The Node client runs tests purely in Node rather than in a browser. This makes it well',
			'  suited for quickly running tests that do not involve the DOM, and and for testing code',
			'  meant to run in a server environment.',
			'',
			'  The WebDriver runner starts and controls a browser using the WebDriver protocol. This',
			'  requires that either a local instance of Selenium is running or that Intern has been',
			'  configured to run tests on a cloud testing service.',
			''
		].join('\n'));

		var reporters = [];
		var reporterDir = path.join(internDir, 'lib', 'reporters');
		fs.readdirSync(reporterDir).filter(function (name) {
			var fullPath = path.join(reporterDir, name);
			return fs.statSync(fullPath).isFile();
		}).forEach(function (name) {
			reporters.push(path.basename(name, '.js'));
		});
		console.log([
			'  Reporters:',
			'',
			'    ' + reporters.join(', '),
			''
		].join('\n'));

		var tunnels = [];
		var digdugDir = path.dirname(require('resolve').sync('digdug/Tunnel', { basedir: process.cwd() }));
		fs.readdirSync(digdugDir).filter(function (name) {
			return /\wTunnel/.test(name);
		}).forEach(function (name) {
			tunnels.push(path.basename(name, '.js'));
		});
		console.log([
			'  Tunnels:',
			'',
			'    ' + tunnels.join(', '),
			''
		].join('\n'));
	});

program 
	.command('serve')
	.description('Start a simple web server for running unit tests in a browser on your system')
	.option('-c, --config <module ID|file>', 'config file to use (default is ' + TESTS_DIR + '/intern.js)')
	.option('-o, --open', 'open the test runner URL when the server starts')
	.option('-I, --noInstrument', 'disable instrumentation')
	.action(function (options) {
		var config = options.config || path.join(TESTS_DIR, 'intern.js');
		var internCmd = path.join(internDir, 'runner');
		var internArgs = [ 'config=' + config, 'proxyOnly' ];

		if (options.noInstrument) {
			internArgs.push('excludeInstrumentation');
		}

		var nodeArgs = [];

		if (options.debug) {
			nodeArgs.push('--debug');
		}

		// TODO: pipe output and watch for listen address. convert 0.0.0.0 to localhost, then use for message or open.
		var spawn = require('child_process').spawn;
		var intern = spawn(process.execPath, nodeArgs.concat(internCmd).concat(internArgs), {
			stdio: [ process.stdin, 'pipe', process.stdout ]
		});

		intern.stdout.on('data', function (data) {
			data = String(data);
			process.stdout.write(data);

			if (/Listening on/.test(data)) {
				var internPath = '/node_modules/intern/client.html?config=' + TESTS_DIR + '/intern';

				// Get the address. Convert 0.0.0.0 to 'localhost' for Windows compatibility.
				var address = data.split(' on ')[1].replace(/^\s*/, '').replace(/\s*$/, '');
				var parts = address.split(':');
				if (parts[0] === '0.0.0.0') {
					parts[0] = 'localhost';
				}
				address = parts.join(':');

				if (options.open) {
					require('opn')('http://' + address + internPath);
				}
				else {
					console.log([
						'To run unit tests, browse to:',
						'',
						'  http://' + address + internPath
					].join('\n'));
				}

				console.log();
				console.log('Press CTRL-C to stop serving.');
			}
		});

		process.on('SIGINT', function () {
			intern.kill('SIGINT');
		});
	})
	.on('--help', function () {
		console.log([
			'  When running WebDriver tests, Intern runs a local server to serve itself and the test',
			'  files to the browser(s) running the tests. This server can also be used instead of a',
			'  dedicated web server such as nginx or Apache for running unit tests locally.',
			''
		].join('\n'));
	});

// Handle any unknown commands
program
	.command('*', null, { noHelp: true })
	.action(function (command) {
		console.log();
		console.error('  unknown command: ' + command);
		console.log();
	});

program.parse(process.argv);

// If no command was given, show the help message
if (process.argv.length === 2) {
	program.outputHelp();
}
