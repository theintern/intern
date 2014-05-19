define([
	'dojo/lang',
	'dojo/Deferred',
	'../../../../../lib/leadfoot/util',
	'../../../../../lib/leadfoot/Server',
	'../../../../../lib/leadfoot/Session'
], function (lang, Deferred, util, Server, Session) {
	return lang.delegate(util, {
		createServer: function (config) {
			return new Server(config);
		},

		createServerFromRemote: function (remote) {
			// Intern 2
			if (remote.session && remote.session.server) {
				return new Server(remote.session.server.url);
			}
			// Intern 1
			else if (remote._wd) {
				return new Server(remote._wd.configUrl.href);
			}

			throw new Error('Unsupported remote');
		},

		createSessionFromRemote: function (remote, SessionCtor, shouldFixGet) {
			SessionCtor = SessionCtor || Session;
			var self = this;
			var server = this.createServerFromRemote(remote);

			function fixGet(session) {
				var oldGet = session.get;
				session.get = function (url) {
					if (!/^[A-Za-z0-9+.-]+:/.test(url)) {
						url = self.convertPathToUrl(remote, url);
					}

					return oldGet.call(this, url);
				};
			}

			// Intern 2
			if (remote.session) {
				session = new SessionCtor(remote.session.sessionId, server, remote.session.capabilities);
				fixGet(session);
				return this.createPromise(session);
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

				var session = new SessionCtor(remote.sessionId, server, capabilities);
				shouldFixGet !== false && fixGet(session);
				return server._fillCapabilities(session);
			}

			throw new Error('Unsupported remote');
		},

		convertPathToUrl: function (session, url) {
			if (session.session) {
				session = session.session;
			}

			return session.proxyUrl + url.slice(session.proxyBasePathLength);
		}
	});
});
