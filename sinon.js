define([ 'require', 'dojo/Deferred', 'dojo/aspect' ], function (require, Deferred, aspect) {
	var loadPromise;
	var sinon;

	// Create a fake XHR server that auto-responds to requests.
	function createFakeServer() {
		var server = sinon.fakeServer.create();
		server.autoRespond = true;
		return server;
	}

	return {
		/**
		 * AMD plugin API interface for easy loading of chai assertion interfaces.
		 */
		load: function (id, parentRequire, callback) {
			if (!loadPromise) {
				var dfd = new Deferred();
				loadPromise = dfd.promise;

				// Reconfigure the loader so that sinon's submodules will be remapped to a mock module. This will
				// prevent race conditions during sinon initialization.
				require.config({
					intern: {
						dojo: 'intern/node_modules/dojo',
						chai: 'intern/node_modules/chai/chai',
						sinonjs: 'intern/node_modules/sinon/lib/sinon',
						'intern/order!sinonjs/spy': 'intern/sinon-mock',
						'intern/order!sinonjs/call': 'intern/sinon-mock',
						'intern/order!sinonjs/behavior': 'intern/sinon-mock',
						'intern/order!sinonjs/stub': 'intern/sinon-mock',
						'intern/order!sinonjs/mock': 'intern/sinon-mock',
						'intern/order!sinonjs/collection': 'intern/sinon-mock',
						'intern/order!sinonjs/assert': 'intern/sinon-mock',
						'intern/order!sinonjs/sandbox': 'intern/sinon-mock',
						'intern/order!sinonjs/test': 'intern/sinon-mock',
						'intern/order!sinonjs/test_case': 'intern/sinon-mock',
						'intern/order!sinonjs/match': 'intern/sinon-mock'
					}
				});

				// Load the main sinon module.
				require([ 'sinonjs' ], function (sinonjs) {
					sinon = sinonjs;

					// Restore the original loader configuration.
					/* globals global */
					require.config((typeof window === 'undefined' ? global : window).__internConfig);

					// Require all the sinon dependencies (for real this time).
					require([
						'intern/order!sinonjs/spy',
						'intern/order!sinonjs/call',
						'intern/order!sinonjs/behavior',
						'intern/order!sinonjs/stub',
						'intern/order!sinonjs/mock',
						'intern/order!sinonjs/collection',
						'intern/order!sinonjs/assert',
						'intern/order!sinonjs/sandbox',
						'intern/order!sinonjs/test',
						'intern/order!sinonjs/test_case',
						'intern/order!sinonjs/match',

						// The fake server functions are automatically attached to the sinon global.
						'intern/order!sinonjs/util/event',
						'intern/order!sinonjs/util/fake_server',
						'intern/order!sinonjs/util/fake_xml_http_request'
					], function (
						spy,
						call,
						behavior,
						stub,
						mock,
						collection,
						assert,
						sandbox,
						test,
						/* jshint camelcase:false */
						test_case,
						match
					) {
						// Attach the dependencies to the main sinon object, just as sinon normally would.
						sinon.spy = spy;
						sinon.call = call;
						sinon.behavior = behavior;
						sinon.stub = stub;
						sinon.mock = mock;
						sinon.collection = collection;
						sinon.assert = assert;
						sinon.sandbox = sandbox;
						sinon.test = test;
						sinon.test_case = test_case;
						sinon.match = match;

						// Change the behavior of useFakeXMLHttpRequest so that it doesn't fake requests to intern's
						// proxy.
						aspect.after(sinon, 'useFakeXMLHttpRequest', function (xhr) {
							xhr.useFilters = true;
							xhr.addFilter(function (method, url) {
								return url.indexOf('/__intern') === 0;
							});
							return xhr;
						});

						dfd.resolve(sinon);
					});
				});
			}
			
			loadPromise.then(function (sinon) {
				if (!id) {
					callback(sinon);
					return;
				}

				if (id === 'createFakeServer') {
					callback(createFakeServer);
					return;
				}

				if (!sinon[id]) {
					throw new Error('Invalid sinon interface "' + id + '"');
				}

				callback(sinon[id]);
			});
		}
	};
});
