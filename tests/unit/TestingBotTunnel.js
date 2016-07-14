define([
	'intern/dojo/node!../../TestingBotTunnel',
	'intern!object',
	'intern/chai!assert'
], function (
	TestingBotTunnel,
	registerSuite,
	assert
) {
	var tunnel;

	registerSuite({
		name: 'unit/TestingBotTunnel',

		beforeEach: function () {
			tunnel = new TestingBotTunnel();
		},

		'#auth': function () {
			tunnel.apiKey = 'foo';
			tunnel.apiSecret = 'bar';
			assert.equal(tunnel.auth, 'foo:bar');
		}
	});
});
