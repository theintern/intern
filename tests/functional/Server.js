/* jshint dojo:true */
define([
	'intern!object',
	'intern/chai!assert',
	'intern/main',
	'./support/util',
	'intern/dojo/node!dojo/Promise',
	'intern/dojo/node!../../../Server',
	'intern/dojo/node!url'
], function (registerSuite, assert, intern, util, Promise, Server, urlUtil) {
	registerSuite(function () {
		var server;

		return {
			name: 'Server',

			setup: function () {
				server = util.createServerFromRemote(this.remote);
			},

			'object constructor with string': function () {
				var server = new Server('https://test:1234/w/d///');
				assert.strictEqual(server.url, 'https://test:1234/w/d/');
			},

			'object constructor with object': function () {
				var server = new Server({
					protocol: 'https',
					hostname: 'test',
					port: 1234,
					pathname: '/w/d'
				});
				assert.strictEqual(server.url, 'https://test:1234/w/d/');
			},

			'object constructor with password auth': function () {
				var server = new Server({
					protocol: 'https',
					hostname: 'test',
					port: 1234,
					pathname: '/w/d/',
					username: 'user',
					password: 'pass'
				});
				assert.strictEqual(server.url, 'https://user:pass@test:1234/w/d/');
			},

			'object constructor with access key auth': function () {
				var server = new Server({
					protocol: 'https',
					hostname: 'test',
					port: 1234,
					pathname: '/w/d/',
					username: 'user',
					accessKey: 'pass'
				});
				assert.strictEqual(server.url, 'https://user:pass@test:1234/w/d/');
			},

			'error handling': function () {
				return server._get('invalidCommand').then(function () {
					throw new Error('Request to invalid command should not be successful');
				}, function (error) {
					assert.strictEqual(error.name, 'UnknownCommand', 'Unknown command should throw error');
				});
			},

			'error output security': function () {
				var url = urlUtil.parse(server.url);
				if (!url.auth) {
					url.auth = 'user:pass';
				}

				var testServer = new Server(url);

				return testServer._get('invalidCommand').then(function () {
					throw new Error('Request to invalid command should not be successful');
				}, function (error) {
					assert.notInclude(error.message, url.auth,
						'HTTP auth credentials should not be displayed in errors');

					url.auth = '(redacted)';
					assert.include(error.message, urlUtil.format(url), 'Redacted URL should be displayed in error');
				});
			},

			'#getStatus': function () {
				return server.getStatus().then(function (result) {
					assert.isObject(result, 'Server should provide an object with details about the server');
				});
			},

			'#getSessions': function () {
				var currentSessionId = this.remote.session ? this.remote.session.sessionId : this.remote.sessionId;
				return server.getSessions().then(function (result) {
					assert.isArray(result);
					assert.operator(result.length, '>=', 1);
					assert.isTrue(result.some(function (session) {
						return currentSessionId === session.id;
					}));
				}).catch(function (error) {
					// Some servers do not support retrieving sessions; this is OK, another server test will verify
					// that this code is working
					if (error.name !== 'UnknownCommand') {
						throw error;
					}
				});
			},

			'#getSessionCapabilities': function () {
				// Intern 2 has remote.session; Intern 1 does not
				var sessionId = this.remote.session.sessionId;
				var remoteCapabilities = this.remote.session.capabilities;

				return server.getSessionCapabilities(sessionId).then(function (capabilities) {
					assert.isObject(capabilities);
					assert.strictEqual(capabilities.browserName, remoteCapabilities.browserName);
					assert.strictEqual(capabilities.version, remoteCapabilities.version);
					assert.strictEqual(capabilities.platform, remoteCapabilities.platform);
					assert.strictEqual(capabilities.platformVersion, remoteCapabilities.platformVersion);
				});
			},

			'#createSession & .sessionConstructor': (function () {
				function CustomSession(sessionId, server, capabilities) {
					this.sessionId = sessionId;
					this.server = server;
					this.capabilities = capabilities;
				}

				var oldCtor;
				var oldPost;
				var mockCapabilities = {
					isMockCapabilities: true
				};
				var desiredCapabilities = {};
				var requiredCapabilities = {};

				return {
					setup: function () {
						oldCtor = server.sessionConstructor;
						oldPost = server._post;
						server.sessionConstructor = CustomSession;
						server.fixSessionCapabilities = false;
						server._post = function (method, data) {
							assert.strictEqual(method, 'session');
							assert.strictEqual(data.desiredCapabilities, desiredCapabilities);
							assert.strictEqual(data.requiredCapabilities, requiredCapabilities);

							return Promise.resolve({
								sessionId: 'test',
								value: mockCapabilities
							});
						};
					},

					'': function () {
						return server.createSession(desiredCapabilities, requiredCapabilities).then(function (session) {
							assert.instanceOf(session, CustomSession);
							assert.strictEqual(session.sessionId, 'test');
							assert.strictEqual(session.server, server);
							assert.isTrue(session.capabilities.isMockCapabilities);
						});
					},

					teardown: function () {
						server.sessionConstructor = oldCtor;
						server.fixSessionCapabilities = true;
						server._post = oldPost;
					}
				};
			})(),

			'#deleteSession': function () {
				var oldDelete = server._delete;
				server._delete = function (command, data, pathData) {
					assert.strictEqual(command, 'session/$0');
					assert.deepEqual(pathData, [ 'test' ]);
					return Promise.resolve(null);
				};

				try {
					server.deleteSession('test');
				}
				finally {
					server._delete = oldDelete;
				}
			}
		};
	});
});
