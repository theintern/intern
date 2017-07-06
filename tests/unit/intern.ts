import _intern from '../../src/intern';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('intern', function () {
	let intern: typeof _intern;
	let removeMocks: () => void;

	return {
		before() {
			return mockRequire(require, 'src/intern', {
				'@dojo/shim/global': {
					default: { intern: 'foo' }
				}
			}).then(handle => {
				removeMocks = handle.remove;
				intern = handle.module.default;
			});
		},

		after() {
			removeMocks();
		},

		tests: {
			intern() {
				assert.equal<any>(intern(), 'foo', 'unexpected value for intern');
			}
		}
	};
});
