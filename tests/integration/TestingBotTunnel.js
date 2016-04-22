define([
	'intern!object',
	'intern/chai!assert',
	'./common',
	'intern/dojo/node!../../TestingBotTunnel'
], function (
	registerSuite,
	assert,
	createCommonTests,
	TestingBotTunnel
) {
	registerSuite(createCommonTests({
		name: 'integration/TestingBotTunnel',

		tunnelClass: TestingBotTunnel,

		assertDescriptor: function (environment) {
			assert.property(environment, 'selenium_name');
			assert.property(environment, 'name');
			assert.property(environment, 'platform');
			assert.property(environment, 'version');
		}
	}));
});
