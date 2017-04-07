import CrossBrowserTestingTunnel from 'src/CrossBrowserTestingTunnel';
import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

let tunnel: CrossBrowserTestingTunnel;

registerSuite({
	name: 'unit/CrossBrowserTestingTunnel',

	beforeEach: function () {
		tunnel = new CrossBrowserTestingTunnel();
	},

	'#auth': function () {
		tunnel.username = 'foo';
		tunnel.accessKey = 'bar';
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
