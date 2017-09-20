import { Minimatch } from 'minimatch';
import request from '@dojo/core/request/providers/xhr';
import Task from '@dojo/core/async/Task';
import global from '@dojo/shim/global';

import Executor, { Config, Events } from './Executor';
import { normalizePathEnding } from '../common/util';
import { RuntimeEnvironment } from '../types';

// Reporters
import Html from '../reporters/Html';
import Dom from '../reporters/Dom';
import ConsoleReporter from '../reporters/Console';

const console: Console = global.console;

/**
 * A Browser executor is used to run unit tests in a browser.
 */
export default class Browser extends Executor<Events, Config> {
	constructor(options?: { [key in keyof Config]?: any }) {
		super(<Config>{
			basePath: '/',
			internPath: 'node_modules/intern/'
		});

		// Report uncaught errors
		global.addEventListener(
			'unhandledRejection',
			(event: PromiseRejectionEvent) => {
				console.warn('Unhandled rejection:', event);
				this.emit('error', event.reason);
			}
		);

		global.addEventListener('error', (event: ErrorEvent) => {
			console.warn('Unhandled error:', event);
			const error = new Error(event.message);
			error.stack = `${event.filename}:${event.lineno}:${event.colno}`;
			this.emit('error', error);
		});

		this.registerReporter('html', Html);
		this.registerReporter('dom', Dom);
		this.registerReporter('console', ConsoleReporter);

		if (options) {
			this.configure(options);
		}
	}

	get environment(): RuntimeEnvironment {
		return 'browser';
	}

	/**
	 * Load a script or scripts via script injection.
	 *
	 * @param script a path to a script
	 */
	loadScript(script: string | string[], isEsm = false) {
		if (typeof script === 'string') {
			script = [script];
		}

		return script.reduce((previous, script) => {
			if (script[0] !== '/') {
				script = `${this.config.basePath}${script}`;
			}
			return previous.then(() => injectScript(script, isEsm));
		}, Task.resolve());
	}

	protected _resolveConfig() {
		return super._resolveConfig().then(() => {
			const config = this.config;

			if (config.internPath[0] !== '/') {
				config.internPath = `${config.basePath}${config.internPath}`;
			}

			['basePath', 'internPath'].forEach((key: keyof Config) => {
				config[key] = normalizePathEnding(<string>config[key]);
			});

			type GlobEntry = {
				suites: string[];
				pattern: string;
				index: number;
			};

			const globSuites: GlobEntry[] = [];
			[config.suites, config.browser.suites].forEach(suites => {
				suites.forEach((pattern, index) => {
					const matcher = new Minimatch(pattern);
					if (
						matcher.set[0].some(entry => typeof entry !== 'string')
					) {
						// suite is a glob
						globSuites.push({ suites, pattern, index });
					}
				});
			});

			if (globSuites.length > 0) {
				return request('__resolveSuites__', {
					query: {
						suites: globSuites.map(entry => entry.pattern)
					}
				})
					.then(response => response.json())
					.catch(() => {
						throw new Error(
							'The server does not support suite glob resolution'
						);
					})
					.then((data: string[][]) => {
						// Process the data in reverse since we'll be modifying the
						// suites lists
						for (let i = data.length - 1; i >= 0; i--) {
							const suites = data[i];
							const globEntry = globSuites[i];
							globEntry.suites.splice(
								globEntry.index,
								1,
								...suites
							);
						}
					});
			}
		});
	}
}

export { Events, Config };

function injectScript(path: string, isEsm: boolean) {
	return new Task<void>((resolve, reject) => {
		const doc: Document = global.document;
		const scriptTag = doc.createElement('script');
		scriptTag.addEventListener('load', () => {
			resolve();
		});
		scriptTag.addEventListener('error', event => {
			console.error(`Error loading ${path}:`, event);
			reject(new Error(`Unable to load ${path}`));
		});
		if (isEsm) {
			scriptTag.type = 'module';
		}
		scriptTag.src = path;
		doc.body.appendChild(scriptTag);
	});
}
