import { spy } from 'sinon';

import Suite from 'src/lib/Suite';
import Test from 'src/lib/Test';
import _Dom from 'src/lib/reporters/Dom';

function createMockNode(tagName: string, parent: any, content?: string) {
	const mockNode = {
		content,
		tagName,
		parentNode: parent,
		style: {},
		children: <any[]>[],
		appendChild: spy((node: any) => {
			mockNode.children.push(node);
			node.parentNode = mockNode;
		}),
		scrollHeight: 0,
		textContent() {
			if (mockNode.children.length > 0) {
				return mockNode.children
					.map(child => child.textContent())
					.join('');
			}
			return mockNode.content || '';
		}
	};
	return mockNode;
}

function createMockDocument() {
	const body = createMockNode('body', createMockNode('html', undefined));
	const doc = {
		body,
		documentElement: body,
		createElement: spy((tagName: string) =>
			createMockNode(tagName, undefined)
		),
		createTextNode: spy((text: string) =>
			createMockNode('', undefined, text)
		)
	};
	return doc;
}

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

const mockExecutor = <any>{
	on() {},
	emit() {},
	formatError(error: Error) {
		return error.stack || error.message;
	}
};

let removeMocks: () => void;
let Dom: typeof _Dom;

registerSuite('intern/lib/reporters/Dom', {
	before() {
		return mockRequire(require, 'src/lib/reporters/Dom', {
			'@dojo/shim/global': { default: { scrollTo() {} } }
		}).then(resource => {
			removeMocks = resource.remove;
			Dom = resource.module.default;
		});
	},

	after() {
		removeMocks();
	},

	tests: {
		error() {
			const mockDocument = createMockDocument();
			const reporter = new Dom(mockExecutor, {
				document: <any>mockDocument
			});
			const error = new Error('Oops');

			reporter.error(error);

			// body contains the error node which contains the error text node
			assert.match(
				mockDocument.body.textContent()!,
				/^Error: Oops/,
				'expected node with error text to have been added'
			);
		},

		suiteEnd: {
			pass() {
				const mockDocument = createMockDocument();
				const reporter = new Dom(mockExecutor, {
					document: <any>mockDocument
				});
				const suite = new Suite({
					executor: mockExecutor,
					name: 'suite',
					tests: [
						new Test({
							name: 'foo',
							test: () => {},
							hasPassed: false
						})
					]
				});

				reporter.suiteEnd(suite);

				assert.lengthOf(
					mockDocument.body.children,
					0,
					'expected no change to the doc'
				);
			},

			fail() {
				const mockDocument = createMockDocument();
				const reporter = new Dom(mockExecutor, {
					document: <any>mockDocument
				});
				const suite = new Suite({
					executor: mockExecutor,
					name: 'suite',
					tests: [
						new Test({
							name: 'foo',
							test: () => {},
							hasPassed: false
						})
					]
				});
				suite.error = new Error('failed');

				reporter.suiteEnd(suite);

				const nodes = mockDocument.body.children;

				// Should see 2 nodes, a notice and the error message
				assert.lengthOf(nodes, 2, 'expected 2 nodes to be added');
				assert.match(nodes[0].textContent(), /Suite .* failed/);
				assert.match(nodes[1].textContent(), /Error: failed/);
			}
		},

		suiteStart() {
			const mockDocument = createMockDocument();
			const reporter = new Dom(mockExecutor, {
				document: <any>mockDocument
			});
			const suite = new Suite(<any>{ name: 'suite', parent: {} });

			reporter.suiteStart(suite);

			const list = mockDocument.body.children[0];
			assert.equal(list.tagName, 'ol');
			assert.lengthOf(list.children, 0);
			assert.equal(list.textContent(), '');

			// subsequent suite
			reporter.suiteStart(suite);
			assert.lengthOf(list.children, 1);
			assert.equal(list.textContent(), 'suite');
		},

		testEnd: {
			pass() {
				const mockDocument = createMockDocument();
				const reporter = new Dom(mockExecutor, {
					document: <any>mockDocument
				});
				const test = new Test({
					name: 'test',
					timeElapsed: 123,
					test: () => {},
					parent: <any>{ name: 'parent', id: 'parent' },
					hasPassed: true
				});

				const testNode = createMockNode('div', undefined);
				reporter.testNode = <any>testNode;
				reporter.testEnd(test);

				const nodes = testNode.children;
				assert.lengthOf(nodes, 1);
				assert.equal(nodes[0].textContent(), ' passed (123ms)');
			},

			fail() {
				const mockDocument = createMockDocument();
				const reporter = new Dom(mockExecutor, {
					document: <any>mockDocument
				});
				const test = new Test({
					name: 'test',
					timeElapsed: 123,
					test: () => {},
					parent: <any>{ name: 'parent', id: 'parent' }
				});
				(<any>test).error = new Error('Oops');

				const testNode = createMockNode('div', undefined);
				reporter.testNode = <any>testNode;
				reporter.testEnd(test);

				const nodes = testNode.children;
				assert.lengthOf(nodes, 2);
				assert.equal(nodes[0].textContent(), ' failed (123ms)');
			},

			skipped() {
				const mockDocument = createMockDocument();
				const reporter = new Dom(mockExecutor, {
					document: <any>mockDocument
				});
				const test = new Test({
					name: 'testy',
					skipped: 'yes',
					test: () => {},
					parent: <any>{ name: 'parent', id: 'parent' }
				});

				reporter.testEnd(test);

				const nodes = reporter.testNode.children;
				assert.lengthOf(nodes, 1);
				assert.equal(
					(<any>nodes[0]).textContent(),
					`${test.name} skipped (yes)`
				);
			}
		},

		testStart() {}
	}
});
