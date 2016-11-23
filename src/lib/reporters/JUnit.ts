import * as util from '../util';
import { Suite } from '../Suite';
import { Test } from '../Test';
import { Reporter, ReporterConfig } from '../../interfaces';
import { Executor } from '../../lib/executors/Executor';

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
	nodeName: string = '';
	childNodes: any[] = [];
	attributes: any;

	constructor(nodeName: string, attributes?: any) {
		this.nodeName = nodeName;

		if (attributes && attributes.childNodes) {
			this.childNodes = attributes.childNodes;
			attributes.childNodes = undefined;
		}
		this.attributes = attributes || {};
	}

	/**
	 * Creates a new XML node and pushes it to the end of the current node.
	 * @param {string} nodeName The node name for the new node.
	 * @param {Object?} attributes Optional attributes for the new node.
	 * @param {(XmlNode|string)[]?} childNodes Optional child nodes for the new node.
	 * @returns {XmlNode} A new node.
	 */
	createNode(nodeName: string, attributes: Object): XmlNode {
		const node = new XmlNode(nodeName, attributes);
		this.childNodes.push(node);
		return node;
	}

	_escape(str: string): string {
		return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
	}

	_serializeAttributes(): string {
		const attributes = this.attributes;
		const nodes: any[] = [];

		for (let key in attributes) {
			if (attributes[key] != null) {
				nodes.push(key + '="' + this._escape(attributes[key]) + '"');
			}
		}

		return nodes.length ? ' ' + nodes.join(' ') : '';
	}

	_serializeContent(): string {
		const nodeList = this.childNodes;
		const nodes: any[] = [];
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

function createTestNode(test: Suite|Test): XmlNode {
	if (test instanceof Suite) {
		return createSuiteNode(test);
	}

	const node = new XmlNode('testcase', {
		name: test.name,
		time: test.timeElapsed / 1000,
		status: test.error ? 1 : 0
	});

	if (test.error) {
		node.createNode(test.error.name === 'AssertionError' ? 'failure' : 'error', {
			childNodes: [ util.getErrorMessage(test.error) ],
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

export class JUnit implements Reporter {
	output: any;
	constructor(config: ReporterConfig = {}) {
		this.output = config.output;
	}

	runEnd(executor: Executor) {
		const rootNode = new XmlNode('testsuites');
		executor.suites.forEach(function (suite) {
			rootNode.childNodes.push(createSuiteNode(suite));
		});

		const report = '<?xml version="1.0" encoding="UTF-8" ?>' + rootNode.toString() + '\n';
		this.output.end(report);
	}
}
