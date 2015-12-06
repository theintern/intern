import { before as aspectBefore } from 'dojo/aspect';
import has = require('dojo/has');
import { deepMixin } from 'dojo/lang';
import Promise = require('dojo/Promise');
import * as main from '../../main';
type _mainType = typeof main;
import * as parseArgs from '../parseArgs';
import { AmdLoaderConfig, AmdRequire, StackError } from '../util';
import * as util from '../util';
import Executor from './Executor';
type _ExecutorType = typeof Executor;

import _requestType = require('dojo/request');
import _pathType = require('path');

/// <amd-dependency name="request" path="dojo/has!host-browser?dojo/request" />
declare var request: _requestType;

declare var require: AmdRequire;

type TODO = any;
type MaybePromise = void | Promise.Thenable<void>;

if (has('host-node')) {
	/* tslint:disable:no-var-keyword */
	var pathUtil: typeof _pathType = require('util');
	/* tslint:enable:no-var-keyword */
}

interface LoaderConfig {
	'host-browser'?: string;
	'host-node'?: string;
}

export interface ReporterConfig {
	id: string;
	filename?: string;
	watermarks?: TODO;
}

interface ClientReporterConfig extends ReporterConfig {
	waitForRunner?: boolean | string | string[];
}

export interface InternConfig extends RawInternConfig {
	config?: string;
	grep?: RegExp;
}

export interface RawInternConfig {
	basePath?: string;
	capabilities?: TODO;
	coverageVariable?: string;
	defaultTimeout?: number;
	environments?: TODO[];
	environmentRetries?: number;
	excludeInstrumentation?: boolean | RegExp;
	functionalSuites?: string[];
	grep?: string | RegExp;

	// TODO: initialBaseUrl is client-only
	initialBaseUrl?: string;

	leaveRemoteOpen?: boolean | string;
	loaders?: LoaderConfig;
	loaderOptions?: AmdLoaderConfig;
	maxConcurrency?: number;
	proxyOnly?: boolean;
	proxyPort?: number;
	proxyUrl?: string;
	reporters?: ReporterConfig[];

	// TODO: Announce deprecated string syntax
	runnerClientReporter?: ClientReporterConfig;

	teardown?: (executor: Executor) => MaybePromise;
	setup?: (executor: Executor) => MaybePromise;
	suites?: string[];
	tunnel?: string;
	tunnelOptions?: TODO;
}

export interface ReportableError {
	reported?: boolean;
}

/**
 * For testing sessions running through the Intern proxy, tells the remote test system that an error occured when
 * attempting to set up this environment.
 *
 * @function
 * @param {Error} error
 */
const sendErrorToConduit = (function () {
	let sequence = 0;

	return function (error: StackError) {
		const sessionIdFromUrl = /[?&]sessionId=([^&]+)/.exec(location.search);
		if (!sessionIdFromUrl) {
			return;
		}

		const sessionId = decodeURIComponent(sessionIdFromUrl[1]);
		request(require.toUrl('intern/'), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			data: JSON.stringify({
				sequence: sequence,
				sessionId: sessionId,
				payload: [
					'fatalError',
					// Non-standard `sessionId` property is used by ClientSuite in the test runner to associate
					// a fatal error with a particular environment
					{ name: error.name, message: error.message, stack: error.stack, sessionId: sessionId }
				]
			})
		});

		// The sequence must not be incremented until after the data is successfully serialised, since an error
		// during serialisation might occur, which would mean the request is never sent, which would mean the
		// dispatcher on the server-side will stall because the sequence numbering will be wrong
		++sequence;
	};
})();

export interface KwArgs {
	defaultLoaderOptions?: AmdLoaderConfig;
	executorId: string;
}

/**
 * The PreExecutor executor handles loading the user’s configuration and setting up the environment with the proper
 * AMD loader.
 *
 * @constructor
 * @param {Object} kwArgs
 */
export default class PreExecutor {
	constructor(kwArgs: KwArgs) {
		this.defaultLoaderOptions = kwArgs.defaultLoaderOptions;

		let executorId = kwArgs.executorId;
		if (executorId.indexOf('/') === -1) {
			executorId = executorId.charAt(0).toUpperCase() + executorId.slice(1);
			executorId = require.toAbsMid('./' + executorId);
		}

		this.executorId = executorId;
	}

	/**
	 * Default loader configuration that needs to be passed to the new loader.
	 */
	defaultLoaderOptions: AmdLoaderConfig;

	_earlyErrorHandle: { remove(): void; };
	_earlyEvents: TODO[];

	/**
	 * The module ID of the executor to load.
	 */
	executorId: string;

	/**
	 * Gets arguments from the command-line/query-string.
	 */
	getArguments() {
		let kwArgs: { [key: string]: any; };
		if (has('host-browser')) {
			kwArgs = parseArgs.fromQueryString(location.search);
		}
		else if (has('host-node')) {
			kwArgs = parseArgs.fromCommandLine(process.argv.slice(2));
		}

		[ 'environments', 'functionalSuites', 'reporters', 'suites' ].forEach(function (name) {
			const value = kwArgs[name];
			if (value != null && !Array.isArray(value)) {
				kwArgs[name] = value === '' ? [] : [ value ];
			}
		});

		this.getArguments = function () {
			return kwArgs;
		};

		return kwArgs;
	}

	/**
	 * Gets the user’s configuration.
	 */
	getConfig(args: { [key: string]: any; }) {
		const moduleId: string = args['config'];

		if (!moduleId) {
			throw new Error('Missing required argument "config"');
		}

		util.assertSafeModuleId(moduleId);

		const promise = util.getModule<RawInternConfig>(
			this.defaultLoaderOptions.baseUrl.replace(/\/?$/, '/' + moduleId.replace(/(?:\.js)?$/, '.js'))
		).then(function (config) {
			/* jshint maxcomplexity:14 */
			config = deepMixin(config, args);

			config.loaderOptions = config.loaderOptions || {};

			let isAbsoluteBaseUrl: (url: string) => boolean;

			if (has('host-node')) {
				if (config.basePath == null) {
					config.basePath = process.cwd();
				}

				config.basePath = util.normalizePath(config.basePath);

				if (config.basePath.charAt(config.basePath.length - 1) !== '/') {
					config.basePath += '/';
				}

				// The crappy fallback function is for Node 0.10; remove it when Node 0.10 is officially dropped
				isAbsoluteBaseUrl = pathUtil.isAbsolute || function (path) {
					if (pathUtil.sep === '/') {
						return path.charAt(0) === '/';
					}
					else {
						return /^\w+:/.test(path);
					}
				};
			}
			else if (has('host-browser')) {
				(function () {
					const defaultBasePath = config.initialBaseUrl ||
						// replacing `/node_modules/intern/client.html` with `/`, allowing for directory name
						// derivatives
						util.normalizePath(location.pathname.replace(/(?:\/+[^\/]*){3}\/?$/, '/'));

					if (config.basePath == null) {
						config.basePath = defaultBasePath;
					}
					else if (config.basePath.charAt(0) === '.') {
						config.basePath = util.normalizePath(defaultBasePath + config.basePath);
					}

					if (config.basePath.charAt(config.basePath.length - 1) !== '/') {
						config.basePath += '/';
					}
				})();

				isAbsoluteBaseUrl = function (url) {
					return /^\w+:/.test(url);
				};
			}

			// If the baseUrl is unset, then it will be the default from client.html or the cwd, which would be
			// inconsistent
			if (!config.loaderOptions.baseUrl) {
				config.loaderOptions.baseUrl = config.basePath;
			}
			// non-absolute loader baseUrl needs to be fixed up to be relative to the defined basePath, not to
			// client.html or process.cwd()
			else if (!isAbsoluteBaseUrl(config.loaderOptions.baseUrl)) {
				config.loaderOptions.baseUrl = util.normalizePath(config.basePath + config.loaderOptions.baseUrl);
			}

			if (config.grep == null) {
				config.grep = new RegExp('');
			}
			else {
				const grep = /^\/(.*)\/([gim]*)$/.exec(<string> config.grep);

				if (grep) {
					config.grep = new RegExp(grep[1], grep[2]);
				}
				else {
					config.grep = new RegExp(<string> config.grep, 'i');
				}
			}

			if (has('host-browser') && args['loaders'] && args['loaders']['host-browser']) {
				util.assertSafeModuleId(<string> args['loaders']['host-browser']);
			}

			return <InternConfig> config;
		});

		this.getConfig = function () {
			return promise;
		};

		return promise;
	}

	/**
	 * Handles errors that occur during the pre-execution sequence.
	 *
	 * @param {Error} error
	 */
	protected _handleError(error: Error) {
		if (has('host-browser')) {
			if (location.pathname.replace(/\/+[^\/]*$/, '/').slice(-10) === '/__intern/') {
				sendErrorToConduit(error);
			}

			const htmlError = util.getErrorMessage(error).replace(/&/g, '&amp;').replace(/</g, '&lt;');
			const errorNode = document.createElement('div');
			errorNode.style.cssText = 'color: red; font-family: sans-serif;';
			errorNode.innerHTML = '<h1>Fatal error during pre-execution stage</h1>' +
				'<pre style="padding: 1em; background-color: #f0f0f0;">' + htmlError + '</pre>';
			document.body.appendChild(errorNode);
		}
		else /* istanbul ignore else */ if (typeof console !== 'undefined') {
			console.error(util.getErrorMessage(error));

			// TODO: The loader needs to be fixed to allow errbacks to `require` calls so we don’t just exit on
			// early error but can instead propagate loader errors through the `PreExecutor#run` promise chain
			if (has('host-node')) {
				process.exit(1);
			}
		}
	}

	/**
	 * Loads the constructor for the real executor for this test run via the final loader environment.
	 *
	 * @param {string} executorId The module ID of the executor.
	 * @param {Function} require An AMD loader `require` function.
	 * @returns {Promise.<Function>} Executor constructor.
	 */
	protected _loadExecutorWithLoader(executorId: string, require: AmdRequire) {
		return util.getModule(executorId, require);
	}

	/**
	 * Registers a global error handler.
	 *
	 * @param {(error:Error) => void} handler
	 * @returns {{ remove: () => void }}
	 */
	registerErrorHandler(handler: (error: Error) => void) {
		if (this._earlyErrorHandle) {
			this._earlyErrorHandle.remove();
			this._earlyErrorHandle = null;
		}

		if (has('host-browser')) {
			/* jshint browser:true */
			return aspectBefore(window, 'onerror', function (message: string, url: string, lineNumber: number, columnNumber: number, error: Error) {
				error = error || new Error(message + ' at ' + url + ':' + lineNumber +
					(columnNumber !== undefined ? ':' + columnNumber : ''));
				handler(error);
			});
		}
		else if (has('host-node')) {
			/* jshint node:true */
			process.on('uncaughtException', function (error: Error) {
				handler(error);
			});
			return {
				remove: function () {
					this.remove = function () {};
					process.removeListener('uncaughtException', handler);
				}
			};
		}
	}

	/**
	 * Runs the test executor.
	 */
	run() {
		const self = this;
		const args = this.getArguments();

		let config: InternConfig;
		const earlyErrorHandler = this._handleError.bind(this);
		let executor: Executor;

		this._earlyErrorHandle = this.registerErrorHandler(earlyErrorHandler);
		this._earlyEvents = [];

		// TODO: Eliminate main.args, main.config, and main.mode in a future release
		const executionMode = (function (id: string) {
			if (id === require.toAbsMid('./Client')) {
				return 'client';
			}
			else if (id === require.toAbsMid('./Runner')) {
				return 'runner';
			}
			else {
				return 'custom';
			}
		})(this.executorId);

		// These values must be populated on the main module prior to loading the configuration module because
		// the configuration module may depend on them in order to perform configuration
		main.args = args;
		main.mode = executionMode;
		main.config = config;

		function getConfig() {
			return self.getConfig(args).then(function (_config) {
				config = _config;
			});
		}

		function loadExecutorWithLoader(loader: AmdRequire) {
			return self._loadExecutorWithLoader(self.executorId, loader);
		}

		function populateMainModule(loader: AmdRequire) {
			return util.getModule('intern/main').then(function (main: _mainType) {
				// The main module needs to be repopulated here because a loader swap may have occurred,
				// in which case this main module is not the same as the main module loaded as a dependency of
				// PreExecutor
				main.args = args;
				main.mode = executionMode;
				main.config = config;
				return loader;
			});
		}

		function runExecutor(Executor: _ExecutorType) {
			executor = new Executor(config, self);
			self._earlyEvents.forEach(function (event) {
				executor.reporterManager.emit.apply(executor.reporterManager, event);
			});
			return executor.run();
		}

		function swapLoader() {
			return self.swapLoader(config.basePath, config.loaders, config.loaderOptions);
		}

		const promise = Promise.resolve(null)
			.then(getConfig)
			.then(swapLoader)
			.then(populateMainModule)
			.then(loadExecutorWithLoader)
			.then(runExecutor)
			.catch<number>(function (error: ReportableError): any {
				// a fatal error hasn't been reported -- ensure the user is notified
				if (!error.reported) {
					earlyErrorHandler(error);
				}
				throw error;
			});

		this.run = function () {
			return promise;
		};

		return promise;
	}

	/**
	 * Swaps the current AMD loader with a different AMD loader.
	 *
	 * @param {{ host-node?: string, host-browser?: string }} loaders Paths to loaders for different environments,
	 * relative to the user configuration module ID.
	 * @param {Object} loaderOptions AMD loader configuration object.
	 * @returns {Promise.<Function>} A promise that resolves to an AMD `require` function.
	 */
	swapLoader(basePath: string, loaders: LoaderConfig, loaderOptions: AmdLoaderConfig) {
		loaders = loaders || {};
		const self = this;
		const global = (function () {
			return this;
		})();

		return new Promise<AmdRequire>(function (resolve, reject) {
			if (has('host-node') && loaders['host-node']) {
				const require = global.require.nodeRequire;

				// Someone is attempting to use the loader module that has already been loaded. If we were to try
				// loading again without deleting it from `require.cache`, Node.js would not re-execute the loader
				// code (the module is cached), so the global `define` that is being undefined below will never be
				// redefined. There is no reason to do anything more in this case; just use the already loaded
				// loader as-is
				if (require.cache[require.resolve(loaders['host-node'])]) {
					resolve(global.require);
					return;
				}

				global.require = global.define = undefined;

				let id = loaders['host-node'];
				const moduleUtil: any = require('module');
				if (moduleUtil._findPath && moduleUtil._nodeModulePaths) {
					const localModulePath = moduleUtil._findPath(id, moduleUtil._nodeModulePaths(basePath));
					if (localModulePath !== false) {
						id = localModulePath;
					}
				}

				let amdRequire: AmdRequire = require(id);

				// The Dojo 1 loader does not export itself, it only exposes itself globally; in this case
				// `amdRequire` is an empty object, not a function. Other loaders return themselves and do not
				// expose globally. This hopefully covers all known loader cases
				amdRequire = typeof amdRequire === 'function' ? amdRequire : global.require;

				// Expose the require globally so dojo/node can hopefully find the original Node.js require;
				// this is needed for at least RequireJS 2.1, which does not expose the global require
				// to child modules
				if (!global.require) {
					global.require = amdRequire;
				}

				resolve(amdRequire);
			}
			else if (has('host-browser') && loaders['host-browser']) {
				global.require = global.define = undefined;
				const script = document.createElement('script');
				script.onload = function () {
					this.onload = this.onerror = null;
					resolve(global.curl || global.requirejs || global.require);
				};
				script.onerror = function () {
					this.parentNode.removeChild(this);
					this.onload = this.onerror = null;
					reject(new Error('Failed to load AMD loader from ' + script.src));
				};

				let loaderUrl = loaders['host-browser'];
				if (!util.isAbsoluteUrl(loaderUrl)) {
					loaderUrl = basePath + loaderUrl;
				}
				script.src = loaderUrl;
				document.head.appendChild(script);
			}
			else {
				resolve(global.require);
			}
		}).then(function (loader: AmdRequire) {
			const setConfig = loader.config ? loader.config.bind(loader) : loader;
			setConfig(self.defaultLoaderOptions);

			if (loaderOptions) {
				if (
					loaderOptions.map && loaderOptions.map['*'] &&
					self.defaultLoaderOptions && self.defaultLoaderOptions.map && self.defaultLoaderOptions.map['*']
				) {
					const userStarMap = loaderOptions.map['*'];
					const defaultStarMap = self.defaultLoaderOptions.map['*'];
					for (const key in defaultStarMap) {
						if (!(key in userStarMap)) {
							userStarMap[key] = defaultStarMap[key];
						}
					}
				}

				setConfig(loaderOptions);
			}

			return loader;
		});
	}
}
