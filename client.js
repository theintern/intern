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
					chai: 'intern/node_modules/chai/chai',
					diff: 'intern/node_modules/diff/diff'
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
		'require'
	], function (main, args, util, parentRequire) {
		if (!args.config) {
			throw new Error('Missing "config" argument');
		}

		if (/^(?:\w+:)?\/\//.test(args.config)) {
			throw new Error('Cross-origin loading of configuration data is not allowed for security reasons');
		}

		main.mode = 'client';

		require([ args.config ], function (config) {
			util.swapLoader(config.useLoader).then(function (require) {
				if (!config.loader) {
					config.loader = {};
				}

				// if a `baseUrl` is specified in the arguments for the page, it should have priority over what came
				// from the configuration file. this is especially important for the runner proxy, which serves
				// `baseUrl` as the root path and so `baseUrl` must become `/` in the client even if it was something
				// else in the config originally (for the server-side loader)
				if (args.baseUrl) {
					config.loader.baseUrl = args.baseUrl;
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
