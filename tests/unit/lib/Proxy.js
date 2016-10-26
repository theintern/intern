define([
	'require',
	'intern!object',
	'intern/chai!assert',
	'../../../lib/Proxy',
	'dojo/Promise',
	'dojo/node!fs',
	'dojo/node!querystring'
], function (
	require,
	registerSuite,
	assert,
	Proxy,
	Promise,
	fs,
	querystring
) {
	function createRequest(url) {
		return {
			method: 'GET',
			url: url
		};
	}

	function createResponse(done) {
		return {
			data: '',
			end: function (data) {
				if (data) {
					this.data += data;
				}
				done && done.call(this);
			},
			write: function (data) {
				this.data += data;
				return true;
			},
			writeHead: function (head) {
				this.headers = head;
			},

			// WritableStream interface methods
			on: function () {},
			once: function () {},
			emit: function () {},

			// EventEmitter interface methods
			prependListener: function () {}
		};
	}

	registerSuite({
		name: 'lib/Proxy',

		_handle: {
			'correct handler called': function () {
				var proxy = new Proxy({ instrument: false });
				proxy._resolveSuites = function () {
					calls.push('resolveSuites');
				};
				proxy._handleFile = function () {
					calls.push('handleFile');
				};
				var request = createRequest();
				var response = createResponse();
				var query = querystring.stringify({ suites: [ 'intern-selftest/tests/unit/*' ] });

				var calls = [];
				request.url = '/__intern/__resolveSuites__?' + query;
				proxy._handler(request, response);
				assert.deepEqual(calls, [ 'resolveSuites' ], '__resolveSuites__ request sent to unexpected handler');

				calls = [];
				request.url = '/__intern/package/module.js';
				proxy._handler(request, response);
				assert.deepEqual(calls, [ 'handleFile' ], 'File request sent to unexpected handler');

				calls = [];
				request.url = '/__intern/package/module';
				proxy._handler(request, response);
				assert.deepEqual(calls, [ 'handleFile' ], 'Module ID request sent to unexpected handler');
			}
		},

		_handleFile: function () {
			var proxy = new Proxy({
				excludeInstrumentation: true,
				// Use empty basePath for path resolution
				basePath: '/'
			});
			// A value for the proxy.server is required for _handleFile to actually handle a file
			proxy.server = true;

			var dfd = new Promise.Deferred();
			var url = require.toUrl('../../../lib/util.js');

			// Strip drive letter from Windows URL
			if (/^\w:\//.test(url)) {
				url = url.slice(2);
			}

			var expected = fs.readFileSync(url, { encoding: 'utf8' });
			var request = createRequest();

			var response = createResponse(function () {
				dfd.resolve(this.data);
			});

			request.url = url;
			proxy._handleFile(request, response);

			return dfd.promise.then(function (data) {
				assert.equal(data, expected);
			});
		},

		_resolveSuites: {
			'invalid package': function () {
				var proxy = new Proxy();
				var query = querystring.stringify({ suites: JSON.stringify([ 'intern-selftests/tests/unit/*' ]) });
				var request = createRequest('/__intern/__resolveSuites__?' + query);
				var response = createResponse();

				proxy._resolveSuites(request, response);

				// Ensure returned value is JSON
				var resolvedSuites;
				assert.doesNotThrow(function () {
					resolvedSuites = JSON.parse(response.data);
				}, 'Returned data should have been a serialized JSON value');

				// If an invalid suite or glob is provided, an empty list should be returned
				assert.lengthOf(resolvedSuites, 0, 'Expected resolved suites list to be empty');
			},

			'valid package': function () {
				var proxy = new Proxy();
				var query = querystring.stringify({ suites: JSON.stringify([
					'intern-selftest/tests/unit/*',
					'intern-selftest/tests/functional/**/*',
				]) });
				var request = createRequest('/__intern/__resolveSuites__?' + query);
				var expected = [
					'intern-selftest/tests/unit/all',
					'intern-selftest/tests/unit/main',
					'intern-selftest/tests/unit/order',
					'intern-selftest/tests/functional/lib/ProxiedSession'
				];
				var response = createResponse();

				proxy._resolveSuites(request, response);

				// Ensure returned value is JSON
				var resolvedSuites;
				assert.doesNotThrow(function () {
					resolvedSuites = JSON.parse(response.data);
				}, 'Returned data should have been a serialized JSON value');

				assert.deepEqual(resolvedSuites, expected);
			}
		}
	});
});
