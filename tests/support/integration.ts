define([
	'intern',
	'intern/chai!assert',
	'intern/dojo/node!fs',
	'intern/dojo/node!path',
	'intern/dojo/node!util',
	'intern/dojo/Promise',
	'./util'
], function (
	intern,
	assert,
	fs,
	pathUtil,
	nodeUtil,
	Promise,
	util
) {
	function addVerboseListeners(tunnel) {
		var handles = [
			tunnel.on('stdout', process.stdout.write.bind(process.stdout)),
			tunnel.on('stderr', process.stdout.write.bind(process.stdout)),
			tunnel.on('downloadprogress', function (info) {
				process.stdout.write('.');
				if (info.loaded >= info.total) {
					process.stdout.write('\n');
				}
			})
		];
		return {
			remove: function () {
				handles.forEach(function (handle) {
					handle.remove();
				});
				handles = [];
			}
		};
	}

	function assertNormalizedProperties(environment) {
		var message = ' undefined for ' + nodeUtil.inspect(environment.descriptor);
		assert.isDefined(environment.browserName, 'browserName' + message);
		assert.isDefined(environment.version, 'version', + message);
		assert.isDefined(environment.platform, 'platform' + message);
	}

	function checkCredentials(tunnel, options) {
		if (options.checkCredentials) {
			return options.checkCredentials(tunnel);
		}
		return (/\S+:\S+/).test(tunnel.auth);
	}

	return {
		addEnvironmentTest: function (suite, TunnelClass, checkEnvironment, options) {
			options = options || {};

			suite.getEnvironments = function () {
				var tunnel = new TunnelClass();

				if (options.needsAuthData && !checkCredentials(tunnel, options)) {
					this.skip('missing auth data');
				}

				var listeners;
				if (intern.args.verbose) {
					listeners = addVerboseListeners(tunnel);
				}

				return tunnel.getEnvironments().then(function (environments) {
					assert.isArray(environments);
					assert.isAbove(environments.length, 0, 'Expected at least 1 environment');
					environments.forEach(function (environment) {
						assertNormalizedProperties(environment);
						assert.property(environment, 'descriptor');
						checkEnvironment(environment.descriptor);
					});
				}).finally(function () {
					if (listeners) {
						listeners.remove();
					}
					return util.cleanup(tunnel);
				});
			};
		},

		addStartStopTest: function (suite, TunnelClass, options) {
			options = options || {};

			suite['start and stop'] = function () {
				var tunnel = new TunnelClass();

				if (options.needsAuthData !== false && !checkCredentials(tunnel, options)) {
					this.skip('missing auth data');
				}

				var listeners;
				if (intern.args.verbose) {
					listeners = addVerboseListeners(tunnel);
				}

				if (options.timeout) {
					this.async(options.timeout);
				}

				return tunnel.start().then(function () {
					return tunnel.stop();
				}).finally(function () {
					if (listeners) {
						listeners.remove();
					}
					return util.cleanup(tunnel);
				});
			};
		}
	};
});

