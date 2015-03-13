define([
	'dojo/aspect',
	'dojo/has',
	'dojo/lang',
	'dojo/Promise',
	'../../main',
	'../parseArgs',
	'../util',
	'require'
], function (aspect, has, lang, Promise, main, parseArgs, util, require) {
	/**
	 * For testing sessions running through the Intern proxy, tells the remote test system that an error occured when
	 * attempting to set up this environment.
	 *
	 * @param {Error} error
	 */
	function sendErrorToConduit(error) {
		require([ 'dojo/request' ], function (request) {
			request(require.toUrl('intern/'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				data: JSON.stringify({
					sequence: 0,
					sessionId: decodeURIComponent(/[?&]sessionId=([^&]+)/.exec(location.search)[0]),
					payload: [ '/error', { name: error.name, message: error.message, stack: error.stack } ]
				})
			});
		});
	}

	/**
	 * The PreExecutor executor handles loading the user’s configuration and setting up the environment with the proper
	 * AMD loader.
	 *
	 * @constructor
	 * @param {Object} kwArgs
	 */
	function PreExecutor(kwArgs) {
		this.defaultLoaderConfig = kwArgs.defaultLoaderConfig;

		var executorId = kwArgs.executorId;
		if (executorId.indexOf('/') === -1) {
			executorId = executorId.charAt(0).toUpperCase() + executorId.slice(1);
			executorId = require.toAbsMid('./' + executorId);
		}

		this.executorId = executorId;
	}

	PreExecutor.prototype = {
		constructor: PreExecutor,

		/**
		 * Default loader configuration that needs to be passed to the new loader.
		 *
		 * @type {Object}
		 */
		defaultLoaderConfig: null,

		_earlyErrorHandle: null,

		/**
		 * The module ID of the executor to load.
		 *
		 * @type {string}
		 */
		executorId: null,

		/**
		 * Gets arguments from the command-line/query-string.
		 *
		 * @returns {Object}
		 */
		getArguments: function () {
			var kwArgs;
			if (has('host-browser')) {
				kwArgs = parseArgs.fromQueryString(location.search);

			}
			else if (has('host-node')) {
				kwArgs = parseArgs.fromCommandLine(process.argv.slice(2));
			}

			this.getArguments = function () {
				return kwArgs;
			};

			return kwArgs;
		},

		/**
		 * Gets the user’s configuration.
		 *
		 * @returns {Promise.<Object>}
		 */
		getConfig: function (args) {
			var moduleId = args.config;

			if (!moduleId) {
				throw new Error('Missing required argument "config"');
			}

			util.assertSafeModuleId(moduleId);

			var promise = util.getModule(moduleId).then(function (config) {
				config = lang.deepMixin(config, args);

				if (config.basePath == null && has('host-node')) {
					config.basePath = process.cwd();
				}

				if (config.grep == null) {
					config.grep = new RegExp('');
				}
				else {
					var grep = /^\/(.*)\/([gim]*)$/.exec(config.grep);

					if (grep) {
						config.grep = new RegExp(grep[1], grep[2]);
					}
					else {
						config.grep = new RegExp(config.grep, 'i');
					}
				}

				[ 'suites', 'functionalSuites', 'reporters' ].forEach(function (name) {
					var value = config[name];
					if (typeof value === 'string') {
						config[name] = value === '' ? [] : [ value ];
					}
				});

				return config;
			});

			this.getConfig = function () {
				return promise;
			};

			return promise;
		},

		/**
		 * Handles errors that occur during the pre-execution sequence.
		 *
		 * @param {Error} error
		 */
		_handleError: function (error) {
			if (has('host-browser') && location.pathname.replace(/\/+[^\/]*$/, '/').slice(-10) === '/__intern/') {
				sendErrorToConduit(error);

				var htmlError = util.getErrorMessage(error).replace(/&/g, '&amp;').replace(/</g, '&lt;');
				var errorNode = document.createElement('div');
				errorNode.style.color = 'red';
				errorNode.innerHTML = '<h1>Fatal error during pre-execution stage</h1>' +
					'<pre style="background-color: #f0f0f0;">' + htmlError + '</pre>';
				document.body.appendChild(errorNode);
			}
			else /* istanbul ignore else */ if (typeof console !== 'undefined') {
				console.error(util.getErrorMessage(error));
			}
		},

		/**
		 * Loads the constructor for the real executor for this test run via the final loader environment.
		 *
		 * @param {string} executorId The module ID of the executor.
		 * @param {Function} require An AMD loader `require` function.
		 * @returns {Promise.<Function>} Executor constructor.
		 */
		_loadExecutorWithLoader: function (executorId, require) {
			return new Promise(function (resolve, reject) {
				require([ executorId ], resolve, reject);
			});
		},

		/**
		 * Registers a global error handler.
		 *
		 * @param {(error:Error) => void} handler
		 * @returns {{ remove: () => void }}
		 */
		registerErrorHandler: function (handler) {
			if (this._earlyErrorHandle) {
				this._earlyErrorHandle.remove();
				this._earlyErrorHandle = null;
			}

			if (has('host-browser')) {
				/* jshint browser:true */
				return aspect.before(window, 'onerror', function (message, url, lineNumber, columnNumber, error) {
					error = error || new Error(message + ' at ' + url + ':' + lineNumber +
						(columnNumber !== undefined ? ':' + columnNumber : ''));
					handler(error);
				});
			}
			else if (has('host-node')) {
				/* jshint node:true */
				process.on('uncaughtException', function (error) {
					handler(error);
				});
				return {
					remove: function () {
						this.remove = function () {};
						process.removeListener('uncaughtException', handler);
					}
				};
			}
		},

		/**
		 * Runs the test executor.
		 */
		run: function () {
			var self = this;
			var args = main.args = this.getArguments();
			var config;
			var earlyErrorHandler = lang.bind(this, '_handleError');
			var executor;

			this._earlyErrorHandle = this.registerErrorHandler(earlyErrorHandler);

			var promise = this
				.getConfig(args)
				.then(function (_config) {
					config = _config;
					return self.swapLoader(config.loaders, config.loaderConfig);
				})
				.then(lang.bind(this, '_loadExecutorWithLoader', this.executorId))
				.then(function (Executor) {
					executor = new Executor(config, self);
					return executor.run();
				})
				.finally(function (valueOrError) {
					if (executor) {
						return executor.reporterManager.emit('stop').then(function () {
							if (valueOrError instanceof Error) {
								throw valueOrError;
							}
						});
					}
					else if (valueOrError instanceof Error) {
						throw valueOrError;
					}
				})
				.catch(function (error) {
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
		},

		/**
		 * Swaps the current AMD loader with a different AMD loader.
		 *
		 * @param {{ host-node?: string, host-browser?: string }} loaders Paths to loaders for different environments,
		 * relative to the user configuration module ID.
		 * @param {Object} loaderConfig AMD loader configuration object.
		 * @returns {Promise.<Function>} A promise that resolves to an AMD `require` function.
		 */
		swapLoader: function (loaders, loaderConfig) {
			loaders = loaders || {};
			var self = this;

			// Backslashes are for Windows paths
			var basePath = require.toUrl(this.configId).replace(/[\\\/][^\\\/]*(?:\?.*?)?$/, '') + '/';
			var global = (function () {
				return this;
			})();

			return new Promise(function (resolve, reject) {
				if (has('host-node') && loaders['host-node']) {
					var require = global.require.nodeRequire;

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
					// TODO: Load starting from basePath, not our AMD loader's file path
					var amdRequire = require(loaders['host-node']);

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
					var script = document.createElement('script');
					script.onload = function () {
						this.onload = this.onerror = null;
						resolve(global.curl || global.requirejs || global.require);
					};
					script.onerror = function () {
						this.parentNode.removeChild(this);
						this.onload = this.onerror = null;
						reject(new Error('Failed to load AMD loader from ' + script.src));
					};
					script.src = basePath + loaders['host-browser'];
					document.head.appendChild(script);
				}
				else {
					resolve(global.require);
				}
			}).then(function (loader) {
				var setConfig = loader.config || loader;
				setConfig(self.defaultLoaderConfig);
				setConfig(loaderConfig);
				return loader;
			});
		}
	};

	return PreExecutor;
});
