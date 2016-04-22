define([
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!util'
], function (
	registerSuite,
	assert,
	util
) {
	return function (descriptor) {
		var metRequirements = false;
		var Tunnel = descriptor.tunnelClass;

		function assertNormalizedProperties(environment) {
			var message = ' undefined for ' + util.inspect(environment.descriptor);
			assert.isDefined(environment.browserName, 'browserName' + message);
			assert.isDefined(environment.version, 'version', + message);
			assert.isDefined(environment.platform, 'platform' + message);
		}

		var suite = {
			name: descriptor.name,

			beforeEach: function () {
				suite.tunnel = new Tunnel();
				metRequirements = !descriptor.requirementsCheck || descriptor.requirementsCheck(suite.tunnel);
			},

			getEnvironments: function () {
				if (!metRequirements) {
					this.skip(descriptor.missingRequirementsMessage);
				}

				return suite.tunnel.getEnvironments().then(function (environments) {
					assert.isArray(environments);
					assert.isAbove(environments.length, 0, 'Expected at least 1 environment');
					environments.forEach(function (environment) {
						assertNormalizedProperties(environment);
						assert.property(environment, 'descriptor');
						descriptor.assertDescriptor(environment.descriptor);
					});
				});
			}
		};

		return suite;
	};
});
