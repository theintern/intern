import Executor, { Config as BaseConfig, Events, initialize, LoaderDescriptor } from './Executor';
import Task from '@dojo/core/async/Task';
import instrument from '../instrument';
import { parseValue } from '../common/util';
import { expandFiles, loadScript, normalizePath, reportUncaughtErrors } from '../node/util';
import { duplicate } from '@dojo/core/lang';
import Formatter from '../node/Formatter';
import { dirname, relative, resolve, sep } from 'path';
import { hookRunInThisContext, hookRequire, unhookRunInThisContext } from 'istanbul-lib-hook';
import Pretty from '../reporters/Pretty';
import Simple from '../reporters/Simple';
import Benchmark from '../reporters/Benchmark';
import Promise from '@dojo/shim/Promise';

/**
 * The Node executor is used to run unit tests in a Node environment.
 */
export default class Node<E extends Events = Events, C extends Config = Config> extends Executor<E, C> {
	static initialize(config?: Partial<Config>) {
		return initialize<Events, Config, Node>(Node, config);
	}

	_unhookRequire: null | (() => void);

	constructor(config?: Partial<C>) {
		super(<C>{
			basePath: process.cwd() + sep,
			nodeSuites: <string[]>[]
		});

		if (config) {
			this.configure(config);
		}

		this.registerReporter('pretty', Pretty);
		this.registerReporter('simple', Simple);
		this.registerReporter('benchmark', Benchmark);

		this._formatter = new Formatter(this.config);

		reportUncaughtErrors(this);
	}

	get environment() {
		return 'node';
	}

	/**
	 * Load a script or scripts using Node's require.
	 *
	 * @param script a path to a script
	 */
	loadScript(script: string | string[]) {
		return loadScript(script);
	}

	protected _beforeRun(): Task<void> {
		return super._beforeRun().then(() => {
			const config = this.config;

			if (this.config.excludeInstrumentation !== true) {
				this._setInstrumentationHooks(this.config.excludeInstrumentation);
			}

			const suite = this._rootSuite;
			suite.grep = config.grep;
			suite.timeout = config.defaultTimeout;
			suite.bail = config.bail;
		});
	}

	/**
	 * Override Executor#_loadSuites to pass a combination of nodeSuites and suites to the loader
	 */
	protected _loadSuites(config?: C) {
		config = duplicate(config || this.config);
		config.suites = config.suites.concat(config.nodeSuites);
		if (config.nodeLoader) {
			config.loader = config.nodeLoader;
		}
		return super._loadSuites(config);
	}

	protected _processOption(name: keyof Config, value: any) {
		switch (name) {
			case 'nodeSuites':
				this.config[name] = parseValue(name, value, 'string[]');
				break;

			default:
				super._processOption(name, value);
				break;
		}
	}

	protected _resolveConfig() {
		return super._resolveConfig().then(() => {
			const config = this.config;

			if (!config.internPath) {
				config.internPath = dirname(dirname(__dirname));
			}

			config.internPath = `${relative(process.cwd(), config.internPath)}${sep}`;

			if (config.reporters.length === 0) {
				config.reporters = [{ reporter: 'simple' }];
			}

			if (!config.nodeSuites) {
				config.nodeSuites = [];
			}

			if (config.benchmarkConfig) {
				config.reporters.push({
					reporter: 'benchmark',
					options: config.benchmarkConfig
				});
			}

			return Promise.all(['suites', 'nodeSuites'].map(property => {
				return expandFiles(config[property]).then(expanded => {
					config[property] = expanded;
				});
			// return void
			})).then(() => {});
		});
	}

	/**
	 * Adds hooks for code coverage instrumentation in the Node.js loader.
	 */
	protected _setInstrumentationHooks(excludeInstrumentation: RegExp) {
		const { instrumenterOptions } = this.config;
		const basePath = normalizePath(`${resolve(this.config.basePath || '')}${sep}`);

		function shouldHook(filename: string) {
			filename = normalizePath(filename);

			return filename.indexOf(basePath) === 0 &&
				// if the string passed to `excludeInstrumentation` changes here, it must also change in
				// `lib/Server.js`
				!excludeInstrumentation.test(filename.slice(basePath.length));
		}

		function instrumentCode(code: string, filename: string) {
			return instrument(code, resolve(filename), instrumenterOptions);
		}

		hookRunInThisContext(shouldHook, instrumentCode);
		this._unhookRequire = hookRequire(shouldHook, instrumentCode);
	}

	protected _removeInstrumentationHooks() {
		unhookRunInThisContext();
		if (this._unhookRequire) {
			this._unhookRequire();
			this._unhookRequire = null;
		}
	}
}

export { Events };

export interface Config extends BaseConfig {
	basePath: string;

	/**
	 * A loader used to load test suites and application modules in a Node environment.
	 */
	nodeLoader: LoaderDescriptor;

	/**
	 * A list of paths to unit tests suite scripts (or some other suite identifier usable by the suite loader) that
	 * will only be loaded in Node environments.
	 */
	nodeSuites: string[];
}
