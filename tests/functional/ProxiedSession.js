define([
	'intern!object',
	'intern/chai!assert',
	'./support/util',
	'require',
	'../../../../lib/leadfoot/ProxiedSession',
	'dojo/topic'
], function (registerSuite, assert, util, require, ProxiedSession, topic) {
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

		function createCoverageTest(method) {
			return function () {
				var coverageArgs;
				var handle = topic.subscribe('/coverage', function () {
					coverageArgs = arguments;
				});

				return session[method](method === 'get' ? 'http://example.invalid/' : undefined).then(function () {
					assert.ok(coverageArgs);
					assert.strictEqual(coverageArgs[0], session.sessionId,
						'Correct session ID should be provided when broadcasting coverage data');
					assert.deepEqual(coverageArgs[1], mockCoverage,
						'Code coverage data retrieved from session should be broadcasted');

					handle.remove();
				}).otherwise(function (error) {
					handle.remove();
					throw error;
				});
			};
		}

		return {
			name: 'lib/leadfoot/ProxiedSession',

			setup: function () {
				return util.createSessionFromRemote(this.remote, ProxiedSession, false).then(function () {
					session = arguments[0];
					session.proxyUrl = proxyUrl;
					session.proxyBasePathLength = proxyBasePathLength;
					oldGet = session._get;
					oldPost = session._post;
					oldDelete = session.server.deleteSession;
					session._get = function () {
						++numGetCalls;
						return util.createPromise(lastUrl);
					};
					session._post = function (path, data) {
						if (path === 'url') {
							lastUrl = data.url;
						}
						else if (path === 'execute' && data.script.indexOf('__internCoverage') > -1) {
							return util.createPromise(JSON.stringify(mockCoverage));
						}

						return util.createPromise(null);
					};
					session.server.deleteSession = function () {
						return util.createPromise(null);
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
					return util.sleep(250);
				}).then(function () {
					assert.closeTo(numGetCalls, 5, 1, 'Heartbeats should occur on the given interval');
					lastNumGetCalls = numGetCalls;

					return session.setHeartbeatInterval(0);
				}).then(function () {
					return util.sleep(100);
				}).then(function () {
					assert.strictEqual(numGetCalls, lastNumGetCalls,
						'No more heartbeats should occur after being disabled');
				});
			}
		};
	});
});
