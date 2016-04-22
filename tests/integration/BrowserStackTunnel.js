define([
	'intern!object',
	'intern/chai!assert',
	'./common',
	'intern/dojo/node!../../BrowserStackTunnel'
], function (
	registerSuite,
	assert,
	createCommonTests,
	BrowserStackTunnel
) {
	registerSuite(createCommonTests({
		name: 'integration/BrowserStackTunnel',

		tunnelClass: BrowserStackTunnel,

		assertDescriptor: function (environment) {
			assert.property(environment, 'os_version');
			assert.property(environment, 'browser');
			assert.property(environment, 'os');
			assert.property(environment, 'device');
			assert.property(environment, 'browser_version');
		},

		requirementsCheck: function (tunnel) {
			return !!tunnel.accessKey && !!tunnel.username;
		},

		missingRequirementsMessage: 'missing credentials. Please provide BrowserStack credentials with the ' +
			'BROWSERSTACK_ACCESS_KEY and BROWSERSTACK_USERNAME environment variables'
	}));
});
