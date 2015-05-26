/* jshint dojo:true, es3:false */
define([
	'intern!object',
	'intern/chai!assert',
	'require',
	'../../../lib/ProxiedSession',
	'dojo/node!leadfoot/Server',
	'dojo/Promise'
], function (registerSuite, assert, require, ProxiedSession, Server, Promise) {
	registerSuite(function () {
		var proxyUrl = 'https://example.invalid/';
		var proxyBasePathLength = require.toUrl('./').length;
		var session;
		var oldGet;
		var oldPost;
		var oldDelete;
		var numGetCalls;
		var lastUrl;
		var mockCoverage = { isMockCoverage: true };

		function createPromise(value) {
			var dfd = new Promise.Deferred();
			dfd.resolve(value);
			return dfd.promise;
		}

		function sleep(ms) {
			var dfd = new Promise.Deferred();
			setTimeout(function () {
				dfd.resolve();
			}, ms);
			return dfd.promise;
		}

		function createServerFromRemote(remote) {
			// Intern 2
			if (remote.session && remote.session.server) {
				return new Server(remote.session.server.url);
			}
			// Intern 1
			else if (remote._wd) {
				return new Server(remote._wd.configUrl.href);
			}

			throw new Error('Unsupported remote');
		}

		function createProxiedSessionFromRemote(remote) {
			var server = createServerFromRemote(remote);
			var session;

			// Intern 2
			if (remote.session) {
				session = new ProxiedSession(remote.session.sessionId, server, remote.session.capabilities);
				return createPromise(session);
			}
			// Intern 1
			else if (remote.sessionId && remote.environmentType) {
				// capabilities on Intern 1.6- remote objects are exposed through the environment type object,
				// but that object contains some additional features that causes a deepEqual comparison to fail;
				// extracting its own properties onto a plain object ensures that capabilities comparison passes,
				// assuming the server is not defective
				var capabilities = {};
				for (var k in remote.environmentType) {
					if (remote.environmentType.hasOwnProperty(k)) {
						capabilities[k] = remote.environmentType[k];
					}
				}

				session = new ProxiedSession(remote.sessionId, server, capabilities);
				return server._fillCapabilities(session);
			}

			throw new Error('Unsupported remote');
		}

		function createCoverageTest(method) {
			return function () {
				var coverageArgs;
				var oldCoverage = session.coverageEnabled;
				var oldCoverageVariable = session.coverageVariable;
				session.coverageEnabled = true;
				session.coverageVariable = '__testCoverage';
				session.reporterManager = {
					emit: function (eventName) {
						if (eventName === 'coverage') {
							coverageArgs = Array.prototype.slice.call(arguments, 1);
						}
					}
				};

				var url = method === 'get' ? 'http://example.invalid/' : undefined;
				return session[method](url).then(function () {
					assert.ok(coverageArgs);
					assert.strictEqual(coverageArgs[0], session.sessionId,
						'Correct session ID should be provided when broadcasting coverage data');
					assert.deepEqual(coverageArgs[1], mockCoverage,
						'Code coverage data retrieved from session should be broadcasted');
				}).finally(function () {
					session.coverageEnabled = oldCoverage;
					session.coverageVariable = oldCoverageVariable;
				});
			};
		}

		return {
			name: 'ProxiedSession',

			setup: function () {
				return createProxiedSessionFromRemote(this.remote).then(function () {
					session = arguments[0];
					session.proxyUrl = proxyUrl;
					session.proxyBasePathLength = proxyBasePathLength;

					oldGet = session._get;
					oldPost = session._post;
					oldDelete = session.server.deleteSession;

					session._get = function () {
						++numGetCalls;
						return createPromise(lastUrl);
					};

					session._post = function (path, data) {
						if (path === 'url') {
							lastUrl = data.url;
						}
						else if (path === 'execute' && data.args && data.args[0] === '__testCoverage') {
							return createPromise(JSON.stringify(mockCoverage));
						}

						return createPromise(null);
					};

					session.server.deleteSession = function () {
						return createPromise(null);
					};
				});
			},

			beforeEach: function () {
				return session.setHeartbeatInterval(0).then(function () {
					numGetCalls = 0;
					lastUrl = undefined;
				});
			},

			teardown: function () {
				if (session) {
					session._get = oldGet;
					session._post = oldPost;
					session.server.deleteSession = oldDelete;
				}
			},

			'#get URL': function () {
				return session.get('http://example.invalid/')
					.then(function () {
						assert.strictEqual(lastUrl, 'http://example.invalid/', 'Real URLs should be passed as-is');
					});
			},

			'#get local file': function () {
				return session.get(require.toUrl('./test'))
					.then(function () {
						assert.strictEqual(lastUrl, proxyUrl + 'test',
							'Local URLs should be converted according to defined proxy URL and base path length');
					});
			},

			'#get coverage': createCoverageTest('get'),

			'#quit coverage': createCoverageTest('quit'),

			'#setHeartbeatInterval': function () {
				var lastNumGetCalls;
				return session.setHeartbeatInterval(50).then(function () {
					return sleep(250);
				}).then(function () {
					assert.closeTo(numGetCalls, 5, 1, 'Heartbeats should occur on the given interval');
					lastNumGetCalls = numGetCalls;

					return session.setHeartbeatInterval(0);
				}).then(function () {
					return sleep(100);
				}).then(function () {
					assert.strictEqual(numGetCalls, lastNumGetCalls,
						'No more heartbeats should occur after being disabled');
				});
			}
		};
	});
});
