define([
	'intern!object',
	'intern/chai!assert',
	'../support/integration',
	'intern/dojo/node!../../TestingBotTunnel'
], function (
	registerSuite,
	assert,
	support,
	TestingBotTunnel
) {
	function checkEnvironment(environment) {
		assert.property(environment, 'selenium_name');
		assert.property(environment, 'name');
		assert.property(environment, 'platform');
		assert.property(environment, 'version');
	}

	var suite = {
		name: 'integration/TestingBotTunnel'
	};

	support.addEnvironmentTest(suite, TestingBotTunnel, checkEnvironment);
	support.addStartStopTest(suite, TestingBotTunnel, { timeout: 30000 });

	registerSuite(suite);
});
