import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import Html from 'src/lib/reporters/Html';

let createdNodes: Element[];

const doc: any = {
	createElement() {
		const elem = document.createElement.apply(document, arguments);
		createdNodes.push(elem);
		return elem;
	},
	createTextNode() {
		const elem = document.createTextNode.apply(document, arguments);
		createdNodes.push(elem);
		return elem;
	},
	createDocumentFragment() {
		return document.createDocumentFragment();
	},
	body: document.body
};

registerSuite({
	name: 'intern/lib/reporters/Html',

	beforeEach() {
		createdNodes = [];
	},

	afterEach() {
		createdNodes.forEach(node => {
			if (node.parentNode) {
				node.parentNode.removeChild(node);
			}
		});
		createdNodes = null;
	},

	suiteStart() {
		const suite: any = {
			parent: {},
			tests: [{}],
			name: 'foo',
			id: 'foo'
		};

		// Check that the reporter isn't doing anything with the DOM that target
		// browsers can't handle
		assert.doesNotThrow(function() {
			const reporter = new Html({ document: doc });
			reporter.run();
			reporter.suiteStart(suite);
		});
	}
});
