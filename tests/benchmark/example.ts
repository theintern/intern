import { BenchmarkTestFunction } from '../../src/lib/BenchmarkTest';
import intern from '../../src/index';

const { registerSuite, async } = intern().getPlugin('interface.benchmark');

registerSuite('example benchmarks', {
	test1() {
		2 * 2;
	},

	test2: (function () {
		const test: BenchmarkTestFunction = function () {
			[1, 2, 3, 4, 5].forEach(function (item) {
				item = item * item;
			});
		};

		test.options = {
		};

		return test;
	})(),

	nested: (function () {
		let counter = 0;

		return {
			beforeEachLoop() {
				counter = 0;
			},

			tests: {
				nested1() {
					counter * 23;
				},

				nested2() {
					counter / 12;
				}
			}
		};
	})(),

	async: async(function (deferred) {
		setTimeout(deferred.callback(function () {
			return 23 / 400;
		}), 200);
	}),

	skip() {
		this.skip('this does nothing now');
	},

	'async skip'() {
		this.skip('this also does nothing now');
	}
});
