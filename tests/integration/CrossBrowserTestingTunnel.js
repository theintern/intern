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
		assert.property(environment, 'api_name');
		assert.deepProperty(environment, 'browsers.0.api_name');
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
