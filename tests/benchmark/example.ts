import { default as registerSuite, async, skip, BenchmarkTestFunction } from '../../src/lib/interfaces/benchmark';

let counter = 0;

registerSuite({
	name: 'example benchmarks',

	test1() {
		return 2 * 2;
	},

	test2: (function () {
		const test: BenchmarkTestFunction = function () {
			[ 1, 2, 3, 4, 5 ].forEach(function (item) {
				item = item * item;
			});
		};

		test.options = {
		};

		return test;
	})(),

	nested: {
		beforeEachLoop() {
			counter = 0;
		},

		nested1() {
			return counter * 23;
		},

		nested2() {
			return counter / 12;
		}
	},

	async1: async(function (deferred) {
		setTimeout(deferred.callback(function () {
			return 23 / 400;
		}), 200);
	}),

	skip1: skip(function () {}, 'this test does nothing right now')
});
