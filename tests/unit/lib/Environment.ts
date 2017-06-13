import Environment from 'src/lib/Environment';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

registerSuite('lib/Environment', {
	'constructor with info'() {
		const type = new Environment({
			browserName: 'Browser',
			version: '1.0',
			platform: 'Platform',
			platformVersion: '2.0'
		});

		assert.strictEqual(type.toString(), 'Browser 1.0 on Platform 2.0');
	},

	'constructor missing info'() {
		const type = new Environment({});
		assert.strictEqual(type.toString(), 'Any browser on any platform');
	}
});
