import { Config as BaseConfig, Events, GenericExecutor, initialize } from './Executor';
import { normalizePathEnding, parseValue } from '../common/util';
import { deepMixin } from '@dojo/core/lang';
import Formatter from '../browser/Formatter';
import Task from '@dojo/core/async/Task';

export class GenericBrowser<E extends Events, C extends Config> extends GenericExecutor<E, C> {
	constructor(config: C) {
		super(config);

		this._formatter = new Formatter(config);
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
	 * Override Executor#_loadSuites to pass a combination of browserSuites and suites to the loader
	 */
	protected _loadSuites() {
		const config = this.config;
		return super._loadSuites(deepMixin({}, config, { suites: config.suites.concat(config.browserSuites) }));
	}

	protected _processOption(name: keyof Config, value: any) {
		switch (name) {
			case 'basePath':
				this.config[name] = parseValue(name, value, 'string');
				break;

			case 'browserSuites':
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

			if (!config.basePath) {
				config.basePath = '/';
			}

			if (!config.internPath) {
				config.internPath = 'node_modules/intern/';
			}

			if (!config.browserSuites) {
				config.browserSuites = [];
			}

			for (let suite of config.suites.concat(config.browserSuites)) {
				if (/[*?]/.test(suite)) {
					throw new Error(`Globs may not be used for browser suites: "${suite}"`);
				}
			}

			[ 'basePath', 'internPath' ].forEach(key => {
				config[key] = normalizePathEnding(config[key]);
			});

			if (config.internPath[0] !== '/') {
				config.internPath = `${config.basePath}${config.internPath}`;
			}
		});
	}
}

/**
 * The Browser executor is used to run unit tests in a browser.
 */
export default class Browser extends GenericBrowser<Events, Config> {
	static initialize(config?: Config) {
		return initialize<Events, Config, Browser>(Browser, config);
	}
}

export interface Config extends BaseConfig {
	/** The absolute path to the project base (defaults to '/') */
	basePath?: string;

	/**
	 * A list of paths to unit tests suite scripts (or some other suite identifier usable by the suite loader) that
	 * will only be loaded in Node environments.
	 */
	browserSuites?: string[];
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
