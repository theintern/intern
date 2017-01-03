define([
	'intern!object',
	'intern/chai!assert',
	'../support/integration',
	'intern/dojo/node!../../BrowserStackTunnel'
], function (
	registerSuite,
	assert,
	support,
	BrowserStackTunnel
) {
	function checkEnvironment(environment) {
		assert.property(environment, 'os_version');
		assert.property(environment, 'browser');
		assert.property(environment, 'os');
		assert.property(environment, 'device');
		assert.property(environment, 'browser_version');
	}

	var suite = {
		name: 'integration/BrowserStackTunnel',
	};

	support.addEnvironmentTest(suite, BrowserStackTunnel, checkEnvironment, {
		needsAuthData: true
	});
	support.addStartStopTest(suite, BrowserStackTunnel);

	registerSuite(suite);
});
