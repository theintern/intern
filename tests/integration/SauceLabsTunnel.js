define([
	'intern!object',
	'intern/chai!assert',
	'../support/integration',
	'intern/dojo/node!../../SauceLabsTunnel'
], function (
	registerSuite,
	assert,
	support,
	SauceLabsTunnel
) {
	function checkEnvironment(environment) {
		assert.property(environment, 'short_version');
		assert.property(environment, 'api_name');
		assert.property(environment, 'os');
	}

	var suite = {
		name: 'integration/SauceLabsTunnel'
	};

	support.addEnvironmentTest(suite, SauceLabsTunnel, checkEnvironment);
	support.addStartStopTest(suite, SauceLabsTunnel, {
		timeout: 120000
	});

	registerSuite(suite);
});
