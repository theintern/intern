/*jshint node:true */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	(function () {
		var internConfig = this.__internConfig = {
			baseUrl: process.cwd(),
			packages: [
				{ name: 'intern', location: __dirname }
			],
			map: {
				intern: {
					dojo: 'intern/node_modules/dojo',
					chai: 'intern/node_modules/chai/chai'
				},
				'*': {
					'intern/dojo': 'intern/node_modules/dojo'
				}
			}
		};

		require('dojo/dojo')(internConfig, [ 'intern/client' ]);
	})();
}
else {
	define([
		'./main',
		'./lib/args',
		'./lib/util',
		'require',
		'dojo/has',
		'dojo/has!host-node?dojo/node!path'
	], function (main, args, util, parentRequire, has, pathUtil) {
		if (!args.config) {
			throw new Error('Missing "config" argument');
		}

		if (/^(?:\w+:)?\/\//.test(args.config)) {
			throw new Error('Cross-origin loading of configuration data is not allowed for security reasons');
		}

		main.mode = 'client';

		require([ args.config ], function (config) {
			// jshint maxcomplexity:12
			util.swapLoader(config.useLoader).then(function (require) {
				if (!config.loader) {
					config.loader = {};
				}

				if (args.basePath) {
					config.basePath = args.basePath;
				}

				if (args.baseUrl) {
					config.loader.baseUrl = args.baseUrl;
				}

				if (has('host-node')) {
					// if the client is running under Node.js, make baseUrl relative to basePath
					config.basePath = pathUtil.resolve(config.basePath || process.cwd());
					if (config.loader.baseUrl) {
						config.loader.baseUrl = pathUtil.resolve(pathUtil.join(config.basePath, config.loader.baseUrl));
					}
				}
				else {
					// if the client is running in a browser, make relative baseUrls relative to the baseUrl
					// specified in client.html, which is the directory containing node_modules
					if (config.loader.baseUrl && config.loader.baseUrl.charAt(0) !== '/') {
						config.loader.baseUrl = this.__internConfig.baseUrl + config.loader.baseUrl;
					}
				}

				// Most loaders expose `require.config` for configuration, but the Dojo 1 loader does not
				(require.config || require)(this.__internConfig);
				(require.config || require)(config.loader);

				require([ parentRequire.toAbsMid('./lib/realClient') ], function (realClient) {
					realClient.run(args, config);
				});
			}, function (error) {
				console.error(error);
			});
		});
	});
}
