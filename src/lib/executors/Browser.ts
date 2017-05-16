import Executor, { Config as BaseConfig, Events, initialize, LoaderDescriptor, PluginDescriptor } from './Executor';
import { normalizePathEnding, parseValue } from '../common/util';
import { duplicate } from '@dojo/core/lang';
import Formatter from '../browser/Formatter';
import Task from '@dojo/core/async/Task';

/**
 * The Browser executor is used to run unit tests in a browser.
 */
export default class Browser<E extends Events = Events, C extends Config = Config> extends Executor<E, C> {
	static initialize(config?: Config) {
		return initialize<Events, Config, Browser>(Browser, config);
	}

	constructor(config?: Partial<C>) {
		super(<C>{
			basePath: '/',
			browserPlugins: <PluginDescriptor[]>[],
			browserSuites: <string[]>[]
		});

		if (config) {
			this.configure(config);
		}

		this._formatter = new Formatter(this.config);

		// Report uncaught errors
		window.addEventListener('unhandledRejection', (event: PromiseRejectionEvent) => {
			console.warn('Unhandled rejection:', event);
			this.emit('error', event.reason);
		});

		window.addEventListener('error', (event: ErrorEvent) => {
			console.warn('Unhandled error:', event);
			const error = new Error(event.message);
			error.stack = `${event.filename}:${event.lineno}:${event.colno}`;
			this.emit('error', error);
		});
	}

	get environment() {
		return 'browser';
	}

	/**
	 * Load a script or scripts via script injection.
	 *
	 * @param script a path to a script
	 */
	loadScript(script: string | string[]) {
		if (script == null) {
			return Task.resolve();
		}

		if (typeof script === 'string') {
			script = [script];
		}

		return script.reduce((previous, script) => {
			if (script[0] !== '/') {
				script = `${this.config.basePath}${script}`;
			}
			return previous.then(() => injectScript(script));
		}, Task.resolve());
	}

	/**
	 * Override Executor#_loadPlugins to pass a combination of browserPlugins and plugins to the loader.
	 */
	protected _loadPlugins() {
		const config = duplicate(this.config);
		config.plugins = config.plugins.concat(config.browserPlugins);
		return super._loadPlugins(config);
	}

	/**
	 * Override Executor#_loadSuites to pass a combination of browserSuites and suites to the loader
	 */
	protected _loadSuites() {
		const config = duplicate(this.config);
		config.suites = config.suites.concat(config.browserSuites);
		config.loader = config.browserLoader || config.loader;
		return super._loadSuites(config);
	}

	protected _processOption(name: keyof Config, value: any) {
		switch (name) {
			case 'basePath':
				this.config[name] = parseValue(name, value, 'string');
				break;

			case 'browserPlugins':
				this.config[name] = parseValue(name, value, 'object[]', 'script');
				break;

			case 'browserSuites':
				this.config[name] = parseValue(name, value, 'string[]');
				break;

			default:
				super._processOption(<keyof BaseConfig>name, value);
				break;
		}
	}

	protected _resolveConfig() {
		return super._resolveConfig().then(() => {
			const config = this.config;

			if (!config.internPath) {
				config.internPath = 'node_modules/intern/';
			}

			// Filter out globs from suites and browser suites
			[ 'suites', 'browserSuites' ].forEach((name: keyof Config) => {
				config[name] = config[name].filter((suite: string) => {
					if (/[*?]/.test(suite)) {
						console.warn(`Globs may not be used for browser suites: "${suite}"`);
						return false;
					}
					return true;
				});
			});

			[ 'basePath', 'internPath' ].forEach((key: keyof Config) => {
				config[key] = normalizePathEnding(config[key]);
			});

			if (config.internPath[0] !== '/') {
				config.internPath = `${config.basePath}${config.internPath}`;
			}
		});
	}
}

export interface Config extends BaseConfig {
	/** A loader used to load test suites and application modules in a browser. */
	browserLoader: LoaderDescriptor;

	/** Plugins that should only be loaded in a browser */
	browserPlugins: PluginDescriptor[];

	/**
	 * A list of paths to unit tests suite scripts (or some other suite identifier usable by the suite loader) that
	 * will only be loaded in browsers.
	 */
	browserSuites: string[];
}

export { Events };

function injectScript(path: string) {
	return new Task<void>((resolve, reject) => {
		const scriptTag = document.createElement('script');
		scriptTag.addEventListener('load', () => {
			resolve();
		});
		scriptTag.addEventListener('error', event => {
			console.error(`Error loading ${path}:`, event);
			reject(new Error(`Unable to load ${path}`));
		});
		scriptTag.src = path;
		document.body.appendChild(scriptTag);
	});
}
