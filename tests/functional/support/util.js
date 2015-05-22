/* jshint dojo:true */
define([
	'intern/dojo/node!dojo/Promise',
	'intern/dojo/node!dojo/lang',
	'intern/dojo/node!../../../../lib/util',
	'intern/dojo/node!../../../../Server',
	'intern/dojo/node!../../../../Session'
], function (Promise, lang, util, Server, Session) {
	return lang.delegate(util, {
		createServer: function (config) {
			return new Server(config);
		},

		createServerFromRemote: function (remote) {
			if (remote.session && remote.session.server) {
				return new Server(remote.session.server.url);
			}

			throw new Error('Unsupported remote');
		},

		createSessionFromRemote: function (remote, SessionCtor) {
			SessionCtor = SessionCtor || Session;
			var self = this;
			var server = this.createServerFromRemote(remote);

			function fixGet(session) {
				var oldGet = session.get;
				session.get = function (url) {
					if (!/^[A-Za-z][A-Za-z0-9+.-]+:/.test(url)) {
						url = self.convertPathToUrl(remote, url);
					}

					return oldGet.call(this, url);
				};
			}

			if (remote.session) {
				var session = new SessionCtor(remote.session.sessionId, server, remote.session.capabilities);
				fixGet(session);
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
