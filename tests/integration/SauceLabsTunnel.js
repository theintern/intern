define([
	'intern!object',
	'intern/chai!assert',
	'./common',
	'intern/dojo/node!../../SauceLabsTunnel'
], function (
	registerSuite,
	assert,
	createCommonTests,
	SauceLabsTunnel
) {
	registerSuite(createCommonTests({
		name: 'integration/SauceLabsTunnel',

		tunnelClass: SauceLabsTunnel,

		assertDescriptor: function (environment) {
			assert.property(environment, 'short_version');
			assert.property(environment, 'api_name');
			assert.property(environment, 'os');
		}
	}));
});
