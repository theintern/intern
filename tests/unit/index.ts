import intern from '../../src/index';

const { registerSuite } = intern().getPlugin('interface.object');
const assert = intern().getPlugin('chai.assert');
const mockRequire = intern().getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('index', function () {
	let index: typeof intern;
	let removeMocks: () => void;

	return {
		before() {
			return mockRequire(require, 'src/index', {
				'@dojo/core/global': {
					default: {
						intern: 'foo'
					}
				}
			}).then(handle => {
				removeMocks = handle.remove;
				index = handle.module.default;
			});
		},

		after() {
			removeMocks();
		},

		tests: {
			intern() {
				assert.equal<any>(index(), 'foo', 'unexpected value for intern');
			}
		}
	};
});
