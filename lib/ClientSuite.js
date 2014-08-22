define([
	'dojo/lang',
	'dojo/Deferred',
	'dojo/topic',
	'dojo/node!url',
	'./args',
	'./Suite'
], function (lang, Deferred, topic, urlUtil, args, Suite) {
	function objectToQuery(object) {
		var query = [];
		var value;

		for (var key in object) {
			value = object[key];

			key = encodeURIComponent(key);

			if (typeof value === 'boolean') {
				// Boolean properties are identified as true by their existence and do not have a corresponding
				// value
				value && query.push(key);
			}
			else if (Array.isArray(value)) {
				for (var i = 0, j = value.length; i < j; ++i) {
					query.push(key + '=' + encodeURIComponent(value[i]));
				}
			}
			else {
				query.push(key + '=' + encodeURIComponent(value));
			}
		}

		return query.join('&');
	}

	function ClientSuite() {
		this.config = {};

		Suite.apply(this, arguments);
	}

	ClientSuite.prototype = lang.mixin(new Suite(), {
		constructor: ClientSuite,
		name: 'unit tests',
		// TODO: Timeouts are not working?
		timeout: 10 * 60 * 1000,
		config: null,

		run: function () {
			function clearHandles() {
				var handle;
				while ((handle = handles.pop())) {
					handle.remove();
				}
			}

			var config = this.config,
				remote = this.remote,
				options = lang.mixin({}, args, {
					// the proxy always serves the baseUrl from the loader configuration as the root of the proxy,
					// so ensure that baseUrl is always set to that root on the client
					baseUrl: urlUtil.parse(config.proxyUrl).pathname,
					reporters: 'webdriver',
					sessionId: remote.sessionId
				}),
				self = this,
				dfd = new Deferred(),
				handles = [
					topic.subscribe('/suite/end', function (suite) {
						if (suite.sessionId === remote.sessionId && !suite.hasParent) {
							self.tests.push(suite);
						}
					}),

					// `remote.get` does not resolve as early as it should. this means it might be too late to pick up
					// errors if we do not start listening for the `/client/end` topic until after `remote.get`
					// executes successfully
					topic.subscribe('/client/end', function (sessionId) {
						if (sessionId === remote.session.sessionId) {
							clearHandles();
							// get about:blank to always collect code coverage data from the page in case it is
							// navigated away later by some other process; this happens during self-testing when
							// the new Leadfoot library takes over
							remote.setHeartbeatInterval(0).get('about:blank').then(lang.hitch(dfd, 'resolve'));
						}
					})
				];

			// Intern runs unit tests on the remote Selenium server by navigating to the client runner HTML page. No
			// real commands are issued after the call to remote.get() below until all unit tests are complete, so
			// we need to make sure that we periodically send no-ops through the channel to ensure the remote server
			// does not treat the session as having timed out
			var timeout = config.capabilities['idle-timeout'];
			if (timeout >= 1 && timeout < Infinity) {
				remote.setHeartbeatInterval((timeout - 1) * 1000);
			}

			remote
				.get(config.proxyUrl + '__intern/client.html?' + objectToQuery(options))
				.catch(function (error) {
					clearHandles();
					remote.setHeartbeatInterval(0).then(function () {
						dfd.reject(error);
					});
				});

			return dfd.promise;
		}
	});

	return ClientSuite;
});
