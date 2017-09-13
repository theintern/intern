import { sync as resolve } from 'resolve';
import { spawn } from 'child_process';
import * as opn from 'opn';
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync
} from 'fs';
import { basename, dirname, join } from 'path';
import { copy, die, exitCodeForSignal, print } from './util';
import { CliContext } from './interfaces';

export const minVersion = '3.0.0';
export const maxVersion = '4.0.0';

export default function install(context: CliContext) {
	const { browsers, commands, vlog, internDir, testsDir } = context;

	commands.init.action(options => {
		try {
			statSync(testsDir);
			die(
				'error: A file or directory named "' +
					testsDir +
					'" already exists.'
			);
		} catch (error) {
			// ignore
		}

		try {
			mkdirSync(testsDir);

			vlog('Created test directory %s/', testsDir);

			const configFile = join(testsDir, 'intern.js');

			let data = readFileSync(
				join(internDir, 'tests', 'example.intern.js'),
				{ encoding: 'utf8' }
			);
			data = data.replace(/myPackage/g, 'app');
			data = data.replace(
				/suites: \[.*?],/,
				"suites: [ 'app/tests/unit/*' ],"
			);
			data = data.replace(
				/functionalSuites: \[.*?],/,
				"functionalSuites: [ 'app/tests/functional/*' ],"
			);
			data = data.replace(/'BrowserStackTunnel'/, "'NullTunnel'");
			data = data.replace(/capabilities: {[\s\S]*?}/, 'capabilities: {}');

			vlog('Using browser: %s', options.browser);
			vlog('Created config file %s', configFile);

			let environment: string;
			if (options.browser === 'firefox') {
				environment = "{ browserName: 'firefox', marionette: true }";
			} else {
				environment = `{ browserName: '"${options.browser}"' }`;
			}
			data = data.replace(
				/environments: \[[\s\S]*?],/,
				`environments: [ ${environment} ],`
			);

			writeFileSync(configFile, data);

			copy(join(__dirname, '..', '..', '..', 'init'), join(testsDir));

			vlog('Copied test files');

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

			const info = (<any>browsers)[options.browser];
			let note = info.note;

			if (!note) {
				note =
					`Note that running WebDriver tests with ${info.name}` +
					` requires ${info.driver} to be available in the system path.`;
			}

			print([
				`${note} See`,
				'',
				`  ${info.url}`,
				'',
				'for more information.',
				''
			]);
		} catch (error) {
			die('error initializing: ' + error);
		}
	});

	commands.run
		.option(
			'-c, --config <module ID|file>',
			`config file to use (default is ${testsDir}/intern.js)`
		)
		.on('--help', () => {
			print([
				'\n',
				'Tests may be run purely in Node using the Node client, or in a ' +
					'browser using the WebDriver runner.',
				'',
				'The Node client runs tests purely in Node rather than in a ' +
					'browser. This makes it well suited for quickly running tests ' +
					'that do not involve the DOM, and and for testing code meant ' +
					'to run in a server environment. Only unit tests will be run ' +
					'when using the Node client.',
				'',
				'The WebDriver runner starts and controls a browser using the WebDriver ' +
					'protocol. This requires that either a local instance of Selenium ' +
					'is running or that Intern has been configured to run tests on a ' +
					'cloud testing service. Both unit and functional tests will be run ' +
					'when using the WebDriver runner.',
				''
			]);

			const reporters: string[] = [];
			const reporterDir = join(internDir, 'lib', 'reporters');
			readdirSync(reporterDir)
				.filter(function(name: string) {
					const fullPath = join(reporterDir, name);
					return statSync(fullPath).isFile();
				})
				.forEach(function(name) {
					reporters.push(basename(name, '.js'));
				});
			print(['Reporters:', '', `  ${reporters.join(', ')}`, '']);

			const tunnels: string[] = [];
			const digdugDir = dirname(
				resolve('digdug/Tunnel', { basedir: process.cwd() })
			);
			readdirSync(digdugDir)
				.filter(name => /\wTunnel/.test(name))
				.forEach(name => {
					tunnels.push(basename(name, '.js'));
				});
			print(['Tunnels:', '', `  ${tunnels.join(', ')}`, '']);
		})
		.action((...args: any[]) => {
			const options = args[args.length - 1];
			const config = options.config || join(testsDir, 'intern.js');

			try {
				statSync(config);
			} catch (error) {
				die([
					`There isn't a test config at "${config}".` +
						' You can specify a different test config ' +
						'with the --config option, or run `intern init` ' +
						'to setup a project for testing.'
				]);
			}

			const mode = options.webdriver ? 'runner' : 'client';
			const internCmd = join(internDir, mode);

			// Allow user-specified args in the standard intern format to be passed through
			const internArgs = args.slice(0, args.length - 1);

			internArgs.push(`config=${config}`);

			for (const suite of options.suites) {
				internArgs.push(`suites=${suite}`);
			}

			for (const suite of options.fsuites) {
				internArgs.push(`functionalSuites=${suite}`);
			}

			for (const reporter of options.reporters) {
				internArgs.push(`reporters=${reporter}`);
			}

			if (options.grep) {
				internArgs.push(`grep=${options.grep}`);
			}

			if (options.bail) {
				internArgs.push('bail');
			}

			if (options.port) {
				internArgs.push(`proxyPort=${options.port}`);
			}

			if (options.timeout) {
				internArgs.push(`defaultTimeout=${options.timeout}`);
			}

			if (options.tunnel) {
				internArgs.push(`tunnel=${options.tunnel}`);
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

			const spawnArgs = [...nodeArgs, internCmd, ...internArgs];

			vlog('Running %s %s', process.execPath, spawnArgs.join(' '));

			const intern = spawn(process.execPath, spawnArgs, {
				stdio: 'inherit'
			});

			process.on('SIGINT', () => intern.kill('SIGINT'));

			intern.on('close', (code: number, signal: string) => {
				if (process.exitCode == null) {
					process.exitCode =
						code != null ? code : exitCodeForSignal(signal);
				}
			});

			intern.on('error', () => {
				if (process.exitCode == null) {
					process.exitCode = 1;
				}
			});
		});

	commands.serve.action(args => {
		const options = args[args.length - 1];
		const config = options.config || join(testsDir, 'intern.js');
		const internCmd = join(internDir, 'runner');

		// Allow user-specified args in the standard intern format to be passed through
		const internArgs = args.slice(0, args.length - 1);

		internArgs.push(`config=${config}`);
		internArgs.push('proxyOnly');

		if (options.port) {
			internArgs.push(`proxyPort=${options.port}`);
		}

		if (options.noInstrument) {
			internArgs.push('excludeInstrumentation');
		}

		const nodeArgs: string[] = [];

		if (options.debug) {
			nodeArgs.push('debug');
		}

		const intern = spawn(
			process.execPath,
			[...nodeArgs, internCmd, ...internArgs],
			{
				stdio: [process.stdin, 'pipe', process.stdout]
			}
		);

		intern.stdout.on('data', data => {
			data = String(data);
			process.stdout.write(data);

			if (/Listening on/.test(data)) {
				const internPath = `/node_modules/intern/client.html?config=${config}`;

				// Get the address. Convert 0.0.0.0 to 'localhost' for Windows
				// compatibility.
				let address = data
					.split(' on ')[1]
					.replace(/^\s*/, '')
					.replace(/\s*$/, '');
				const parts = address.split(':');
				if (parts[0] === '0.0.0.0') {
					parts[0] = 'localhost';
				}
				address = parts.join(':');

				if (options.open) {
					opn(`http://${address}${internPath}`);
				} else {
					print([
						'',
						'To run unit tests, browse to:',
						'',
						`  http://${address}${internPath}`
					]);
				}

				print();
				print('Press CTRL-C to stop serving.');
				print();
			}
		});

		process.on('SIGINT', () => {
			intern.kill('SIGINT');
		});
	});
}
