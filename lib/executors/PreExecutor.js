define([
	'dojo/aspect',
	'dojo/has',
	'dojo/lang',
	'dojo/Promise',
	'dojo/has!host-node?dojo/node!path',
	'../../main',
	'../parseArgs',
	'../util',
	'require'
], function (aspect, has, lang, Promise, pathUtil, main, parseArgs, util, require) {
	/**
	 * For testing sessions running through the Intern proxy, tells the remote test system that an error occured when
	 * attempting to set up this environment.
	 *
	 * @function
	 * @param {Error} error
	 */
	var sendErrorToConduit = (function () {
		var sequence = 0;

		return function (error) {
			var sessionIdFromUrl = /[?&]sessionId=([^&]+)/.exec(location.search);
			if (!sessionIdFromUrl) {
				return;
			}

			var sessionId = decodeURIComponent(sessionIdFromUrl[1]);
			require([ 'dojo/request' ], function (request) {
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
			});
		};
	})();

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

				if (has('host-node')) {
					if (config.basePath == null) {
						config.basePath = process.cwd() + pathUtil.sep;
					}
					else if (config.basePath.charAt(config.basePath.length - 1) !== pathUtil.sep) {
						config.basePath += pathUtil.sep;
					}
				}
				else if (has('host-browser')) {
					if (config.basePath && config.basePath.charAt(config.basePath.length - 1) !== '/') {
						config.basePath += '/';
					}
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
					if (typeof value !== 'undefined' && !Array.isArray(value)) {
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
			if (has('host-browser')) {
				if (location.pathname.replace(/\/+[^\/]*$/, '/').slice(-10) === '/__intern/') {
					sendErrorToConduit(error);
				}

				var htmlError = util.getErrorMessage(error).replace(/&/g, '&amp;').replace(/</g, '&lt;');
				var errorNode = document.createElement('div');
				errorNode.style.cssText = 'color: red; font-family: sans-serif;';
				errorNode.innerHTML = '<h1>Fatal error during pre-execution stage</h1>' +
					'<pre style="padding: 1em; background-color: #f0f0f0;">' + htmlError + '</pre>';
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
			var args = this.getArguments();

			// TODO: Eliminate main.args, main.config, and main.mode in a future release
			main.args = args;
			main.mode = (function (id) {
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

			var config;
			var earlyErrorHandler = lang.bind(this, '_handleError');
			var executor;

			this._earlyErrorHandle = this.registerErrorHandler(earlyErrorHandler);

			var earlyEvents = [];

			function getConfig() {
				return self.getConfig(args).then(function (_config) {
					main.config = config = _config;

					if (typeof config.loader === 'object') {
						earlyEvents.push([
							'deprecated',
							'The "loader" configuration option',
							'"loaderConfig"'
						]);
						config.loaderConfig = config.loader;
					}
					if (typeof config.useLoader === 'object') {
						earlyEvents.push([
							'deprecated',
							'The "useLoader" configuration option',
							'"loaders"'
						]);
						config.loaders = config.useLoader;
					}
				});
			}

			function loadExecutorWithLoader(loader) {
				return self._loadExecutorWithLoader(self.executorId, loader);
			}

			function runExecutor(Executor) {
				executor = new Executor(config, self);
				earlyEvents.forEach(function (event) {
					executor.reporterManager.emit.apply(executor.reporterManager, event);
				});
				return executor.run();
			}

			function swapLoader() {
				return self.swapLoader(config.loaders, config.loaderConfig);
			}

			var promise = Promise.resolve()
				.then(getConfig)
				.then(swapLoader)
				.then(loadExecutorWithLoader)
				.then(runExecutor)
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
				var setConfig = loader.config ? loader.config.bind(loader) : loader;
				setConfig(self.defaultLoaderConfig);

				if (loaderConfig) {
					if (
						loaderConfig.map && loaderConfig.map['*'] &&
						self.defaultLoaderConfig && self.defaultLoaderConfig.map && self.defaultLoaderConfig.map['*']
					) {
						var userStarMap = loaderConfig.map['*'];
						var defaultStarMap = self.defaultLoaderConfig.map['*'];
						for (var key in defaultStarMap) {
							if (!(key in userStarMap)) {
								userStarMap[key] = defaultStarMap[key];
							}
						}
					}

					setConfig(loaderConfig);
				}

				return loader;
			});
		}
	};

	return PreExecutor;
});
