define([
	'intern/dojo/node!../../CrossBrowserTestingTunnel',
	'intern!object',
	'intern/chai!assert'
], function (
	CrossBrowserTestingTunnel,
	registerSuite,
	assert
) {
	var tunnel;

	registerSuite({
		name: 'unit/CrossBrowserTestingTunnel',

		beforeEach: function () {
			tunnel = new CrossBrowserTestingTunnel();
		},

		'#auth': function () {
			tunnel.username = 'foo';
			tunnel.apiKey = 'bar';
			assert.equal(tunnel.auth, 'foo:bar');
		},

		'#executable': function () {
			assert.equal(tunnel.executable, 'node');
		},

		'#extraCapabilities': function () {
			assert.property(tunnel.extraCapabilities, 'username');
			assert.property(tunnel.extraCapabilities, 'password');
		}
	});
});
