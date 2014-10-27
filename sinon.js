define([
	'require',
	'dojo/Deferred',
	'dojo/aspect',
	'sinon'
], function (require, Deferred, aspect, sinon) {
	// Create a fake XHR server that auto-responds to requests.
	function createFakeServer() {
		var server = sinon.fakeServer.create();
		server.autoRespond = true;
		return server;
	}

	// Change the behavior of useFakeXMLHttpRequest so that it doesn't fake requests to intern's
	// proxy.
	aspect.after(sinon, 'useFakeXMLHttpRequest', function (xhr) {
		xhr.useFilters = true;
		xhr.addFilter(function (method, url) {
			return url.indexOf('/__intern') === 0;
		});
		return xhr;
	});

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
