import { spawn } from 'child_process';
import * as opn from 'opn';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { die, exitCodeForSignal, print, readJsonFile } from './util';
import { CliContext } from './interfaces';

export const minVersion = '4.0.0';
export const maxVersion = '5.0.0';

export default function install(context: CliContext) {
	const { commands, vlog, internDir, testsDir } = context;

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

	commands.init.action(async options => {
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
			const configFile = 'intern.json';
			let data: any;

			// TODO should this also deal with extended configs?
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
				const functionalGlob = join(
					testsDir,
					'functional',
					'**',
					'*.js'
				);

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

			if (
				JSON.stringify(resources[name]) === JSON.stringify(data[name])
			) {
				return false;
			}

			let answer = await new Promise<string>(resolve => {
				print([
					'',
					'The existing intern.json has the following ' +
						`value for ${name}:`,
					''
				]);
				print('  ', data[name]);
				print([
					'',
					'The default value based on our project layout is:',
					''
				]);
				print('  ', resources[name]);
				rl.question('\n  Should the default be used? ', resolve);
			});

			if (answer.toLowerCase()[0] !== 'y') {
				return false;
			}

			return true;
		}
	});

	commands.run
		.on('--help', () => {
			print([
				'',
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
				`  ${tunnels.join(', ')}`,
				''
			]);
		})
		.action(async (args, command) => {
			const config = command.config || 'intern.json';

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
			const internArgs = args || [];

			internArgs.push(`config=${config}`);

			for (const suite of command.suites) {
				internArgs.push(`suites=${suite}`);
			}

			for (const suite of command.fsuites) {
				internArgs.push(`functionalSuites=${suite}`);
			}

			for (const reporter of command.reporters) {
				internArgs.push(`reporters=${reporter}`);
			}

			if (command.grep) {
				internArgs.push(`grep=${command.grep}`);
			}

			if (command.bail) {
				internArgs.push('bail');
			}

			if (command.port) {
				internArgs.push(`proxyPort=${command.port}`);
			}

			if (command.timeout) {
				internArgs.push(`defaultTimeout=${command.timeout}`);
			}

			if (command.tunnel) {
				internArgs.push(`tunnel=${command.tunnel}`);
			}

			if (command.noInstrument) {
				internArgs.push('excludeInstrumentation');
			}

			if (command.leaveRemoteOpen) {
				internArgs.push('leaveRemoteOpen');
			}

			// 'verbose' is a top-level option
			if (command.parent.verbose) {
				internArgs.push('verbose');
			}

			const nodeArgs: string[] = [];

			if (command.debug) {
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

	commands.serve.action((args, command) => {
		const config = command.config || 'intern.json';
		const internCmd = join(internDir, 'bin', 'intern.js');

		// Allow user-specified args in the standard intern format to be passed through
		const internArgs = args || [];

		internArgs.push(`config=${config}`);
		internArgs.push('serveOnly');

		if (command.port) {
			internArgs.push(`proxyPort=${command.port}`);
		}

		if (command.noInstrument) {
			internArgs.push('excludeInstrumentation');
		}

		const nodeArgs: string[] = [];

		if (command.debug) {
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

				if (command.open) {
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
