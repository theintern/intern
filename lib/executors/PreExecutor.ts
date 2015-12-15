import { before as aspectBefore } from 'dojo/aspect';
import { deepMixin } from 'dojo/lang';
import has = require('dojo/has');
import Promise = require('dojo/Promise');

// TODO: Remove main module entirely
import * as main from '../../main';
type _mainType = typeof main;

import * as parseArgs from '../parseArgs';
// TODO: AMD definitions should not be coming from util!
import { assertSafeModuleId, AmdLoaderConfig, AmdRequire, getErrorMessage, getModule, normalizePath, StackError } from '../util';

import Executor from './Executor';
type ExecutorConstructor = typeof Executor;

import { Watermarks } from 'istanbul/lib/report/common/defaults';
import { Loader, NodeLoader, AmdLoader } from '../Loaders';
import { ReportableError } from '../ReporterManager';

import _requestType = require('dojo/request');
import _pathType = require('path');

// TODO: Properly define type and move elsewhere
declare var define: any;
has.add('loader-amd', typeof define !== 'undefined' && Boolean(define.amd));

/// <amd-dependency name="request" path="dojo/has!host-browser?dojo/request" />
declare var request: _requestType;

// TODO: Move to higher scope
type Require = AmdRequire | NodeRequire;
export interface Hash<T> {
	[key: string]: T;
}

declare var require: Require;

type MaybePromise = any | Promise.Thenable<any>;

if (has('host-node')) {
	/* tslint:disable:no-var-keyword */
	var pathUtil: typeof _pathType = require('path');
	/* tslint:enable:no-var-keyword */
}

interface LoaderConfig {
	'host-browser'?: string;
	'host-node'?: string;
	'host-worker'?: string;
}

export interface ReporterConfig {
	id: string;
	filename?: string;
	// TODO: Should not be on all reporters, only coverage reporters
	watermarks?: Watermarks;
}

interface ClientReporterConfig extends ReporterConfig {
	waitForRunner?: boolean | string | string[];
}

/**
 * A fully processed Intern configuration object, ready for use by the rest of the test system.
 */
export interface InternConfig extends RawInternConfig {
	config?: string;
	executor?: string;
	grep?: RegExp;
}

export interface Capabilities extends leadfoot.Capabilities {
	name?: string;
	build?: string;
	'idle-timeout'?: number;
}

/**
 * RawInternConfig is an incomplete configuration object that is created by the test system
 * while merging command-line arguments into the configuration file provided by the user.
 * Once all processing is complete, the resulting configuration object is of type InternConfig.
 */
export interface RawInternConfig {
	basePath?: string;
	capabilities?: Capabilities;
	coverageVariable?: string;
	defaultTimeout?: number;
	environments?: Capabilities[];
	environmentRetries?: number;
	excludeInstrumentation?: boolean | RegExp;
	executor?: string;
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
	tunnelOptions?: any;
}

/**
 * For testing sessions running through the Intern proxy, tells the remote test system that an error occured when
 * attempting to set up this environment.
 */
const sendErrorToConduit = (function () {
	let sequence = 0;

	return function (url: string, error: StackError) {
		const sessionIdFromUrl = /[?&]sessionId=([^&]+)/.exec(location.search);
		if (!sessionIdFromUrl) {
			return;
		}

		const sessionId = decodeURIComponent(sessionIdFromUrl[1]);
		request(url, {
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

/**
 * The PreExecutor executor handles loading the user’s configuration and setting up the environment with the proper
 * loader.
 */
export default class PreExecutor {
	/**
	 * Reads arguments from the current environment and ensures that any specified arguments that
	 * are known to be array values are explicitly converted to arrays.
	 */
	static getArguments() {
		let args: Hash<any>;
		if (has('host-browser')) {
			args = parseArgs.fromQueryString(location.search);
		}
		else if (has('host-node')) {
			args = parseArgs.fromCommandLine(process.argv.slice(2));
		}

		// Configuration values that are arrays, but which are specified only once in arguments,
		// need to be explicitly converted from single scalar values to arrays
		for (const name of [ 'environments', 'functionalSuites', 'reporters', 'suites' ]) {
			const value = args[name];
			if (value != null && !Array.isArray(value)) {
				args[name] = value === '' ? [] : [ value ];
			}
		}

		PreExecutor.validateArguments(args);

		return args;
	}

	/**
	 * Module IDs and paths may be provided in arguments passed to Intern, which are
	 * then mixed into the main Intern configuration for this run. While extremely
	 * unlikely, this could pose a potential security risk to anyone that exposes an
	 * installation of Intern to the world on a domain that can request sensitive
	 * resources, since arguments could be passed to Intern to load arbitrary
	 * JavaScript from third-party domains. To avoid this problem, module IDs and
	 * paths are validated to ensure only same-domain resources can be requested.
	 */
	static validateArguments(args: Hash<any>) {
		if (has('host-browser') || has('host-worker')) {
			assertSafeModuleId(args['basePath']);
			assertSafeModuleId(args['config']);
			assertSafeModuleId(args['executor']);
			assertSafeModuleId(args['initialBaseUrl']);

			if (args['loaders']) {
				assertSafeModuleId(args['loaders']['host-browser']);
				assertSafeModuleId(args['loaders']['host-worker']);
			}

			// Since any loader can be used with Intern, it is not possible to know
			// exactly which loader options might be a security risk. So, we simply
			// disallow any configuration of the loader options through arguments
			if (args['loaderOptions']) {
				throw new Error('For security reasons, loader options cannot be configured by passing arguments. Please set loader options in your configuration file.');
			}

			if (args['reporters']) {
				for (const reporter of args['reporters']) {
					if (typeof reporter === 'string') {
						assertSafeModuleId(reporter);
					}
					else if (reporter) {
						assertSafeModuleId(reporter.id);
					}
				}
			}

			if (args['suites']) {
				args['suites'].forEach(assertSafeModuleId);
			}
		}
	}

	/**
	 * Retrieves raw Intern configuration from the configuration module. If the configuration
	 * module exports a configuration factory, `args` will be passed to the configuration
	 * factory in order to generate the raw configuration.
	 */
	static getConfig(moduleId: string, args: Hash<any>) {
		type ConfigFactory = (args: Hash<any>) => RawInternConfig;
		type MaybeConfig = RawInternConfig | ConfigFactory;

		return getModule<MaybeConfig>(moduleId, require).then(function (userConfig) {
			if (typeof userConfig === 'function') {
				return (<ConfigFactory> userConfig)(args);
			}

			return <RawInternConfig> userConfig;
		});
	}

	static normalizeConfigGrep(config: { grep?: string | RegExp; }) {
		let value = config.grep;

		if (value instanceof RegExp) {
			return;
		}

		if (value == null) {
			config.grep = new RegExp('');
			return;
		}

		const regExpString = /^\/(.*)\/([gim]*)$/.exec(<string> value);

		if (regExpString) {
			config.grep = new RegExp(regExpString[1], regExpString[2]);
		}
		else {
			config.grep = new RegExp(<string> value, 'i');
		}
	}

	static normalizeConfigBasePath(config: { basePath?: string; initialBaseUrl?: string; }) {
		let basePath: string = config.basePath;

		if (has('host-node')) {
			if (basePath == null) {
				basePath = process.cwd();
			}

			basePath = normalizePath(basePath);

			if (basePath.charAt(basePath.length - 1) !== '/') {
				basePath += '/';
			}
		}
		else if (has('host-browser')) {
			const defaultBasePath = config.initialBaseUrl ||
				// replacing `/node_modules/intern/client.html` with `/`, allowing for directory name
				// derivatives
				normalizePath(location.pathname.replace(/(?:\/+[^\/]*){3}\/?$/, '/'));

			if (basePath == null) {
				basePath = defaultBasePath;
			}
			else if (basePath.charAt(0) === '.') {
				basePath = normalizePath(defaultBasePath + basePath);
			}

			if (basePath.charAt(basePath.length - 1) !== '/') {
				basePath += '/';
			}
		}

		config.basePath = basePath;
	}

	static normalizeConfigLoaderOptions(config: { basePath?: string; loaderOptions?: { baseUrl?: string; }; }) {
		const isAbsoluteBaseUrl = (function () {
			if (has('host-node')) {
				return pathUtil.isAbsolute;
			}
			else if (has('host-browser')) {
				return function (url: string) {
					return /^\w+:/.test(url);
				};
			}
		})();

		let loaderOptions = config.loaderOptions;

		if (!loaderOptions) {
			loaderOptions = config.loaderOptions = {};
		}

		// If the baseUrl is unset, then it will be the default from client.html or the cwd, which would be
		// inconsistent
		if (!loaderOptions.baseUrl) {
			loaderOptions.baseUrl = config.basePath;
		}
		// non-absolute loader baseUrl needs to be fixed up to be relative to the defined basePath, not to
		// client.html or process.cwd()
		else if (!isAbsoluteBaseUrl(loaderOptions.baseUrl)) {
			loaderOptions.baseUrl = normalizePath(config.basePath + loaderOptions.baseUrl);
		}
	}

	static buildFinalConfig(rawConfig: RawInternConfig, args: Hash<any>, defaults: RawInternConfig) {
		let config: RawInternConfig = deepMixin(deepMixin(deepMixin({}, defaults), <RawInternConfig> rawConfig), args);

		// deepMixin normally overrides entries in arrays, but packages configuration needs to be *merged*
		// between the defaults and the user configuration
		config.loaderOptions.packages = defaults.loaderOptions.packages.slice(0);
		if (rawConfig.loaderOptions && rawConfig.loaderOptions.packages) {
			config.loaderOptions.packages.push(...rawConfig.loaderOptions.packages);
		}

		PreExecutor.normalizeConfigBasePath(config);
		PreExecutor.normalizeConfigLoaderOptions(config);
		PreExecutor.normalizeConfigGrep(config);

		return <InternConfig> config;
	}

	protected defaultConfig: RawInternConfig;

	protected _earlyErrorHandle: { remove(): void; };
	protected _earlyEvents: IArguments[];

	protected _loader: Loader;

	constructor(defaultConfig: RawInternConfig) {
		this.defaultConfig = defaultConfig;
	}

	/**
	 * Gets arguments from the command-line/query-string.
	 */
	getArguments() {
		const args = PreExecutor.getArguments();

		this.getArguments = function () {
			return args;
		};

		return args;
	}

	/**
	 * Gets the final configuration for the test system.
	 */
	getConfig(args: Hash<any>) {
		const moduleId: string = args['config'];

		if (!moduleId) {
			throw new Error('Missing required argument "config". Please specify the Intern configuration file you want to use.');
		}

		// To avoid a configuration module named 'intern.js' in the base directory from being interpreted by the
		// loader as a request to load the 'intern' package as a configuration file, the base path is explicitly
		// prepended to the module prior to loading
		const modulePath = this.defaultConfig.basePath.replace(/\/?$/, '/' + moduleId.replace(/(?:\.js)?$/, '.js'));

		const self = this;
		const config = PreExecutor.getConfig(modulePath, args).then(function (rawConfig) {
			return PreExecutor.buildFinalConfig(rawConfig, args, self.defaultConfig);
		});

		this.getConfig = function () {
			return config;
		};

		return config;
	}

	getModule<T>(moduleId: string, require?: Require): Promise<T> {
		if (!this._loader) {
			return Promise.reject(new Error('No module loader has been created yet for this execution environment. Do not call getModule until after swapLoader is done.'));
		}

		return this._loader.import<T>(moduleId, require);
	}

	/**
	 * Handles errors that occur during the pre-execution sequence.
	 *
	 * @param {Error} error
	 */
	protected _handleError(error: Error) {
		if (has('host-browser')) {
			if (location.pathname.replace(/\/+[^\/]*$/, '/').slice(-10) === '/__intern/') {
				sendErrorToConduit('/__intern/', error);
			}

			const htmlError = getErrorMessage(error).replace(/&/g, '&amp;').replace(/</g, '&lt;');
			const errorNode = document.createElement('div');
			errorNode.style.cssText = 'color: red; font-family: sans-serif;';
			errorNode.innerHTML = '<h1>Fatal error during pre-execution stage</h1>' +
				'<pre style="padding: 1em; background-color: #f0f0f0;">' + htmlError + '</pre>';
			document.body.appendChild(errorNode);
		}
		else /* istanbul ignore else */ if (typeof console !== 'undefined') {
			console.error(getErrorMessage(error));

			// TODO: The loader needs to be fixed to allow errbacks to `require` calls so we don’t just exit on
			// early error but can instead propagate loader errors through the `PreExecutor#run` promise chain
			if (has('host-node')) {
				process.exit(1);
			}
		}
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
			return aspectBefore(window, 'onerror', function (message: string, url: string, lineNumber: number, columnNumber: number, error: Error) {
				error = error || new Error(message + ' at ' + url + ':' + lineNumber +
					(columnNumber !== undefined ? ':' + columnNumber : ''));
				handler(error);
			});
		}
		else if (has('host-node')) {
			process.on('uncaughtException', function (error: Error) {
				handler(error);
			});
			return {
				remove() {
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

		function getConfig() {
			return self.getConfig(args).then(function (_config) {
				config = _config;
			});
		}

		function loadExecutorWithLoader(loader: Loader) {
			let executorId = config.executor;

			if (!executorId) {
				throw new Error('The type of executor to be used by the test system is missing. Please specify the module ID of an executor in the "executor" configuration option.');
			}

			// Client or Runner
			if (executorId.indexOf('/') === -1) {
				executorId = './' + executorId;
			}

			return loader.import(executorId, require);
		}

		function runExecutor(Executor: ExecutorConstructor) {
			executor = new Executor(config, self);
			self._earlyEvents.forEach(function (event) {
				executor.reporterManager.emit.apply(executor.reporterManager, event);
			});
			return executor.run();
		}

		function swapLoader() {
			return self.swapLoader(config.basePath, config.loaders, config.loaderOptions).then(function (loader) {
				self._loader = loader;
				return loader;
			});
		}

		const promise: Promise<number> = Promise.resolve(undefined)
			.then(getConfig)
			.then(swapLoader)
			.then(loadExecutorWithLoader)
			.then(runExecutor)
			.catch(function (error: ReportableError): any {
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
	swapLoader(basePath: string, loaders: LoaderConfig = {}, loaderOptions: AmdLoaderConfig) {
		return new Promise<Loader>(function (resolve, reject) {
			if (has('host-node') && loaders['host-node']) {
				let loaderId = loaders['host-node'];
				const moduleUtil: any = require('module');
				if (moduleUtil._findPath && moduleUtil._nodeModulePaths) {
					const localModulePath = moduleUtil._findPath(loaderId, moduleUtil._nodeModulePaths(basePath));
					if (localModulePath !== false) {
						loaderId = localModulePath;
					}
				}

				resolve(AmdLoader.create(loaderId, loaderOptions, require));
			}
			else if (has('host-browser') && loaders['host-browser']) {
				resolve(AmdLoader.create(loaders['host-browser'], loaderOptions, document));
			}
			else if (has('host-worker') && loaders['host-worker']) {
				resolve(AmdLoader.create(loaders['host-worker'], loaderOptions, importScripts));
			}
			else if (has('host-node')) {
				resolve(new NodeLoader(loaderOptions, <NodeRequire> require));
			}
			else if (has('host-browser')) {
				resolve(AmdLoader.create(null, loaderOptions, document));
			}
			else if (has('host-worker')) {
				resolve(AmdLoader.create(null, loaderOptions, importScripts));
			}
			else {
				throw new Error('Unknown environment. Please open a ticket at https://github.com/theintern/intern for support.');
			}
		});
	}
}
