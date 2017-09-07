import { spawn } from 'child_process';
import * as opn from 'opn';
import { sync as glob } from 'glob';
import {
	existsSync,
	mkdirSync,
	statSync,
	writeFileSync
} from 'fs';
import { join } from 'path';
import { die, exitCodeForSignal, print, readJsonFile } from './util';
import { CliContext } from './interfaces';

export const minVersion = '4.0.0';
export const maxVersion = '5.0.0';

export default function install(context: CliContext) {
	const { commands, vlog, internDir, testsDir } = context;

	commands.init.action(options => {
		if (!existsSync(testsDir)) {
			try {
				mkdirSync(testsDir);
				vlog('Created test directory %s/', testsDir);
			} catch (error) {
				die('error creating test directory: ' + error);
			}
		}

		try {
			const configFile = 'intern.json';
			let data: any;
			if (existsSync(configFile)) {
				data = readJsonFile(configFile);
			} else {
				data = {};
			}

			const testsGlob = join(testsDir, '**', '*.js');
			if (glob(testsGlob).length > 0) {
				data.suites = [testsGlob];
			}

			if (existsSync(join(testsDir, 'functional'))) {
				const functionalGlob = join(testsDir, 'functional', '**', '*.js');
				data.suites.push(`!${functionalGlob}`);
				data.functionalSuites = [functionalGlob];
				data.environments = [{ browserName: options.browser }];
			}

			vlog('Using browser: %s', options.browser);
			vlog('Saved config to %s', configFile);

			writeFileSync(configFile, JSON.stringify(data, null, '\t'));

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
		}
	});

	commands.run
		.on('--help', () => {
			print();

			// const reporters: string[] = [];
			// const reporterDir = join(internDir, 'lib', 'reporters');
			// readdirSync(reporterDir)
			// 	.filter(function(name: string) {
			// 		const fullPath = join(reporterDir, name);
			// 		return statSync(fullPath).isFile();
			// 	})
			// 	.forEach(function(name) {
			// 		reporters.push(basename(name, '.js'));
			// 	});
			// print(['Reporters:', '', `  ${reporters.join(', ')}`, '']);

			// const tunnels: string[] = [];
			// const digdugDir = dirname(
			// 	resolve('digdug/Tunnel', { basedir: process.cwd() })
			// );
			// readdirSync(digdugDir)
			// 	.filter(name => /\wTunnel/.test(name))
			// 	.forEach(name => {
			// 		tunnels.push(basename(name, '.js'));
			// 	});
			// print(['Tunnels:', '', `  ${tunnels.join(', ')}`, '']);
		})
		.action((...args: any[]) => {
			const options = args[args.length - 1];
			const config = options.config || 'intern.json';

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

			const internCmd = join(internDir, 'bin', 'intern.js');

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

	commands.serve
		.action(args => {
			const options = args[args.length - 1];
			const config = options.config || join(testsDir, 'intern.js');
			const internCmd = join(internDir, 'runner');

			// Allow user-specified args in the standard intern format to be passed through
			const internArgs = args.slice(0, args.length - 1);

			internArgs.push(`config=${config}`);
			internArgs.push('serveOnly');

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
		})
		.on('--help', () => {
			print(
				'When running WebDriver tests, Intern runs a local server to ' +
					'serve itself and the test files to the browser(s) running the ' +
					'tests. This server can also be used instead of a dedicated web ' +
					'server such as nginx or Apache for running unit tests locally.'
			);
			print();
		});
}
