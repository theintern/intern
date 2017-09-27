import { spy } from 'sinon';

import * as _tddInt from 'src/lib/interfaces/tdd';
import Test from 'src/lib/Test';
import Suite from 'src/lib/Suite';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/interfaces/tdd', function() {
	let tddInt: typeof _tddInt;
	let removeMocks: () => void;
	let parent: Suite;

	const executor = {
		addSuite: spy((callback: (suite: Suite) => void) => {
			callback(parent);
		}),
		emit: spy(() => {})
	};
	const getIntern = spy(() => {
		return executor;
	});
	const mockGlobal = {
		get intern() {
			return getIntern();
		}
	};

	return {
		before() {
			return mockRequire(require, 'src/lib/interfaces/tdd', {
				'@dojo/shim/global': { default: mockGlobal }
			}).then(handle => {
				removeMocks = handle.remove;
				tddInt = handle.module;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			getIntern.reset();
			executor.addSuite.reset();
			executor.emit.reset();
			parent = new Suite(<any>{ name: 'parent', executor });
		},

		tests: {
			getInterface() {
				const iface = tddInt.getInterface(<any>executor);
				assert.isFunction(iface.suite);
				assert.isFunction(iface.test);
				assert.isFunction(iface.before);
				assert.isFunction(iface.after);
				assert.isFunction(iface.beforeEach);
				assert.isFunction(iface.afterEach);

				iface.suite('fooSuite', () => {});
				assert.lengthOf(parent.tests, 1);
				assert.equal(parent.tests[0].name, 'fooSuite');
			},

			suite() {
				tddInt.suite('foo', () => {});
				assert.lengthOf(parent.tests, 1);
				assert.instanceOf(parent.tests[0], Suite);
				assert.equal(parent.tests[0].name, 'foo');
			},

			test() {
				tddInt.suite('foo', () => {
					tddInt.test('bar', () => {});
				});
				const child = (<Suite>parent.tests[0]).tests[0];
				assert.instanceOf(child, Test);
				assert.equal(child.name, 'bar');

				assert.throws(() => {
					tddInt.test('baz', () => {});
				}, /must be declared/);
			},

			'lifecycle methods': (() => {
				type lifecycle =
					| 'before'
					| 'beforeEach'
					| 'after'
					| 'afterEach';
				function createTest(name: lifecycle) {
					return () => {
						tddInt.suite('foo', () => {
							(tddInt[name] as any)(() => {});
						});
						const suite = <Suite>parent.tests[0];
						assert.instanceOf(suite[name], Function);

						assert.throws(() => {
							(tddInt[name] as any)(() => {});
						}, /must be declared/);
					};
				}

				return {
					before: createTest('before'),
					after: createTest('after'),
					beforeEach: createTest('beforeEach'),
					afterEach: createTest('afterEach')
				};
			})(),

			'multiple of same lifecycle method'() {
				let firstIsResolved = false;
				const dfd = this.async();

				tddInt.suite('foo', () => {
					tddInt.beforeEach(() => {
						return new Promise<void>(resolve => {
							setTimeout(() => {
								firstIsResolved = true;
								resolve(<any>'foo');
							}, 100);
						});
					});

					tddInt.beforeEach(
						dfd.rejectOnError(() => {
							assert.isTrue(
								firstIsResolved,
								'expected first beforeEach to be resolved'
							);
							return new Promise<void>(resolve => {
								setTimeout(() => {
									resolve(<any>'bar');
								}, 100);
							});
						})
					);

					tddInt.test('fooTest', () => {});
				});

				const suite = <Suite>parent.tests[0];
				Promise.resolve<string>(<any>suite.beforeEach(
					<any>{},
					<any>{}
				)).then(
					dfd.callback((result: string) => {
						assert.equal(result, 'bar');
					})
				);
			},

			'nested suites'() {
				tddInt.suite('fooSuite', () => {
					tddInt.test('foo', () => {});
					tddInt.suite('bar', () => {
						tddInt.beforeEach(() => {});

						tddInt.test('up', () => {});
						tddInt.test('down', () => {});
					});
					tddInt.suite('baz', () => {
						tddInt.test('one', () => {});
						tddInt.test('down', () => {});
					});
				});

				assert.lengthOf(
					parent.tests,
					1,
					'one child should have been defined on parent'
				);
				const suite = <Suite>parent.tests[0];
				assert.lengthOf(
					suite.tests,
					3,
					'expect suite to have 3 children'
				);

				assert.instanceOf(suite.tests[0], Test);
				assert.equal(suite.tests[0].name, 'foo');

				assert.instanceOf(suite.tests[1], Suite);
				assert.equal(suite.tests[1].name, 'bar');
				assert.isFunction(
					(<Suite>suite.tests[1]).beforeEach,
					'expected suite to have a beforeEach method'
				);

				assert.instanceOf(suite.tests[2], Suite);
				assert.equal(suite.tests[2].name, 'baz');
			}
		}
	};
});
