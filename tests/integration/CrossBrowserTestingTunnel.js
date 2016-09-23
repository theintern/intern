define([
	'intern!object',
	'intern/chai!assert',
	'../support/integration',
	'intern/dojo/node!../../CrossBrowserTestingTunnel'
], function (
	registerSuite,
	assert,
	support,
	CrossBrowserTestingTunnel
) {
	function checkEnvironment(environment) {
		assert.property(environment, 'short_version');
		assert.property(environment, 'api_name');
		assert.property(environment, 'os');
	}

	var suite = {
		name: 'integration/CrossBrowserTestingTunnel'
	};

	support.addEnvironmentTest(suite, CrossBrowserTestingTunnel, checkEnvironment, {
		needsAuthData: true
	});
	support.addStartStopTest(suite, CrossBrowserTestingTunnel);

	registerSuite(suite);
});
