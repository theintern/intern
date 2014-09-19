define([
	// Use intern/order to load sinon modules in the same order as the built sinon.js does.
	'intern/order!sinonjs',
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
	'intern/order!sinonjs/util/event',

	// The fake server functions are automatically attached to the sinon global.
	'intern/order!sinonjs/util/fake_server',
	'intern/order!sinonjs/util/fake_xml_http_request'
], function (sinon, spy, call, behavior, stub, mock, collection, assert, sandbox, test, test_case, match) {
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

	// Globally disable request mocking to the Intern proxy.
	var realUseFakeXMLHttpRequest = sinon.useFakeXMLHttpRequest;
	sinon.useFakeXMLHttpRequest = function () {
		console.log('creating a new fake request');
		var xhr = realUseFakeXMLHttpRequest.apply(sinon, arguments);
		xhr.useFilters = true;
		xhr.addFilter(function (method, url) {
			return url.indexOf('/__intern') === 0;
		});
		return xhr;
	};

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
		}
	};
});
