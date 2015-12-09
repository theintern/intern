import { getErrorMessage } from '../util';
import Executor from '../executors/Executor';
import Suite from '../Suite';
import Test from '../Test';
import { Reporter, ReporterKwArgs } from '../ReporterManager';

/**
 * There is no formal spec for this format and everyone does it differently, so good luck! We've mashed as many of the
 * different incompatible JUnit/xUnit XSDs as possible into one reporter.
 */

/**
 * Simple XML generator.
 * @constructor
 * @param {string} nodeName The node name.
 * @param {Object?} attributes Optional attributes.
 */
class XmlNode {
	constructor(nodeName: string, attributes?: { [key: string]: any; childNodes?: XmlNode[]; }) {
		this.nodeName = nodeName;

		if (attributes && attributes.childNodes) {
			this.childNodes = attributes.childNodes;
			attributes.childNodes = undefined;
		}
		else {
			this.childNodes = [];
		}

		this.attributes = attributes || {};
	}

	nodeName: string;
	childNodes: XmlNode[];
	attributes: { [key: string]: any; };

	/**
	 * Creates a new XML node and pushes it to the end of the current node.
	 * @param {string} nodeName The node name for the new node.
	 * @param {Object?} attributes Optional attributes for the new node.
	 * @returns {XmlNode} A new node.
	 */
	createNode(nodeName: string, attributes?: {}) {
		const node = new XmlNode(nodeName, attributes);
		this.childNodes.push(node);
		return node;
	}

	private _escape(string: any) {
		return String(string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
	}

	private _serializeAttributes() {
		const attributes = this.attributes;
		const nodes: string[] = [];

		for (const key in attributes) {
			if (attributes[key] != null) {
				nodes.push(key + '="' + this._escape(attributes[key]) + '"');
			}
		}

		return nodes.length ? ' ' + nodes.join(' ') : '';
	}

	private _serializeContent() {
		const nodeList = this.childNodes;
		const nodes: string[] = [];
		for (let i = 0, j = nodeList.length; i < j; ++i) {
			nodes.push(typeof nodeList[i] === 'string' ? this._escape(nodeList[i]) : nodeList[i].toString());
		}

		return nodes.join('');
	}

	/**
	 * Outputs the node as a serialised XML string.
	 * @returns {string}
	 */
	toString() {
		const children = this._serializeContent();

		return '<' + this.nodeName + this._serializeAttributes() +
			(children.length ? '>' + children + '</' + this.nodeName + '>' : '/>');
	}
}

function createSuiteNode(suite: Suite): XmlNode {
	return new XmlNode('testsuite', {
		name: suite.name || 'Node.js',
		failures: suite.numFailedTests,
		skipped: suite.numSkippedTests,
		tests: suite.numTests,
		time: suite.timeElapsed / 1000,
		childNodes: suite.tests.map(createTestNode)
	});
}

function createTestNode(testOrSuite: Suite | Test): XmlNode {
	if ((<Suite> testOrSuite).tests) {
		return createSuiteNode(<Suite> testOrSuite);
	}

	const test = <Test> testOrSuite;
	const node = new XmlNode('testcase', {
		name: test.name,
		time: test.timeElapsed / 1000,
		status: test.error ? 1 : 0
	});

	if (test.error) {
		node.createNode(test.error.name === 'AssertionError' ? 'failure' : 'error', {
			childNodes: [ getErrorMessage(test.error) ],
			message: test.error.message,
			type: test.error.name
		});
	}
	else if (test.skipped != null) {
		node.createNode('skipped', {
			childNodes: [ test.skipped ]
		});
	}

	return node;
}

export default class JUnit implements Reporter {
	constructor(config: ReporterKwArgs = {}) {
		this.output = config.output;
	}

	output: NodeJS.WritableStream;

	runEnd(executor: Executor) {
		const rootNode = new XmlNode('testsuites');
		executor.suites.forEach(function (suite) {
			rootNode.childNodes.push(createSuiteNode(suite));
		});

		const report = '<?xml version="1.0" encoding="UTF-8" ?>' + rootNode.toString() + '\n';
		this.output.end(report);
	}
}
