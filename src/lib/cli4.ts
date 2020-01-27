import { execSync, spawn } from 'child_process';
import * as opn from 'opn';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { watch } from 'chokidar';
import { collect, die, print, readJsonFile } from './util';
import { CliContext } from './interfaces';

export const minVersion = '4.0.0';
export const maxVersion = '5.0.0';

export default function install(context: CliContext) {
	const { program, commands, vlog, internDir, testsDir } = context;

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

	program.on('--help', () => {
		try {
			const text = execSync(
				`${join(internDir, 'bin', 'intern.js')} showConfigs`,
				{ encoding: 'utf8' }
			).trim();
			if (text) {
				print([`Using config file at ${defaultConfig}:`, '']);
				print(`  ${text}`);
			} else {
				print(`Using config file at ${defaultConfig}`);
			}
		} catch (error) {
			// ignore
		}
	});

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
			const configFile = defaultConfig;
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
				print();
				print([
					'The existing config file has the following ' +
						`value for ${name}:`,
					''
				]);
				print('  ', data[name]);
				print();
				print([
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
		.option(
			'-c, --config <file>[@config]',
			`config file to use (default is ${defaultConfig})`
		)
		.option(
			'-f, --fsuites <file|glob>',
			'specify a functional suite to run (can be used multiple times)',
			collect,
			[]
		)
		.option(
			'-r, --reporters <name>',
			'specify a reporter (can be used multiple times)',
			collect,
			[]
		)
		.option(
			'-s, --suites <file|glob>',
			'specify a suite to run (can be used multiple times)',
			collect,
			[]
		)
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
		.action(async (args, command) => {
			const { getConfig } = require(join(
				internDir,
				'lib',
				'node',
				'util'
			));
			const { config, file } = await getConfig(command.config);
			const internArgs = args || [];

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
				internArgs.push(`serverPort=${command.port}`);
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

			if (command.node) {
				internArgs.push('environments=');
			}

			if (command.webdriver) {
				// Clear out any node or general suites
				internArgs.push('node.suites=');
				internArgs.push('suites=');

				// If the user provided suites, apply them only to the browser
				// environment
				if (command.suites) {
					internArgs.push(
						...command.suites.map((suites: string) => {
							return `browser.suites+=${suites}`;
						})
					);
				}

				// If the config had general suites, move them to the browser
				// environment
				if (config.suites) {
					internArgs.push(
						...config.suites.map((suites: string) => {
							return `browser.suites+=${suites}`;
						})
					);
				}
			}

			if (command.node && command.webdriver) {
				die('Only one of --node and --webdriver may be specified');
			}

			// 'verbose' is a top-level option
			if (command.parent.verbose) {
				internArgs.push('debug');
			}

			await runIntern(internDir, file, command.debug, internArgs);
		});

	commands.watch = program
		.command('watch [files]')
		.description(
			'Watch test and app files for changes and re-run Node-based ' +
				'unit tests when files are updated'
		)
		.action(async (_files, command) => {
			const { getConfig } = require(join(
				internDir,
				'lib',
				'node',
				'util'
			));
			const { config, file } = await getConfig(command.config);
			const configNodeSuites = (config.node && config.node.suites) || [];
			const nodeSuites = [
				...config.suites,
				...configNodeSuites
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
					const toTest = Array.from(suites.values());
					suites = new Set();

					const args = [
						'environments=',
						...toTest.map(suite => `suites=${suite}`)
					];
					await runIntern(internDir, file, command.debug, args);
				});
			}

			await runIntern(internDir, file, command.debug, ['environments=']);
		});

	commands.serve.action((args, command) => {
		const config = command.config || defaultConfig;
		const internCmd = join(internDir, 'bin', 'intern.js');

		// Allow user-specified args in the standard intern format to be passed
		// through
		const internArgs = args || [];

		internArgs.push(`config=${config}`);
		internArgs.push('serveOnly');

		if (command.port) {
			internArgs.push(`serverPort=${command.port}`);
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
				const internPath = `/node_modules/intern/?config=${config}`;

				// Get the address. Convert 0.0.0.0 to 'localhost' for Windows
				// compatibility.
				let address = data.split(' ')[2];
				const parts = address.split(':');
				if (parts[0] === '0.0.0.0') {
					parts[0] = 'localhost';
				}
				address = parts.join(':');

				if (command.open) {
					opn(`http://${address}${internPath}`);
				} else {
					print();
					print([
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

	function runIntern(
		internDir: string,
		configFile: string,
		debug: boolean,
		args?: any[]
	) {
		try {
			statSync(configFile);
		} catch (error) {
			die([
				`There isn't a test config at "${configFile}".` +
					' You can specify a different test config ' +
					'with the --config option, or run `intern init` ' +
					'to setup a project for testing.'
			]);
		}

		const internArgs = args || [];
		internArgs.push(`config=${configFile}`);

		const internCmd = join(internDir, 'bin', 'intern.js');
		const nodeArgs: string[] = debug ? ['debug'] : [];
		const spawnArgs = [...nodeArgs, internCmd, ...internArgs];
		let signalHandler: () => void;

		vlog('Running %s %s', process.execPath, spawnArgs.join(' '));

		return new Promise((resolve, reject) => {
			const intern = spawn(process.execPath, spawnArgs, {
				stdio: 'inherit'
			});

			signalHandler = () => intern.kill('SIGINT');

			process.on('SIGINT', signalHandler);
			intern.on('close', resolve);
			intern.on('error', reject);
		})
			.then(() => {
				process.removeListener('SIGINT', signalHandler);
			})
			.catch(error => {
				process.removeListener('SIGINT', signalHandler);
				throw error;
			});
	}
}

const defaultConfig = 'intern.json';
