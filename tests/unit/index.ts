import _intern from '../../src/index';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('index', function () {
	let index: typeof _intern;
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
