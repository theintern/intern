import { createWriteStream } from 'fs';
import { dirname } from 'path';

import Suite, { isSuite } from '../Suite';
import Test from '../Test';
import Reporter, { eventHandler, ReporterProperties } from './Reporter';
import { Executor } from '../executors/Executor';
import { mkdirp } from '../node/util';

/**
 * There is no formal spec for this format and everyone does it differently, so
 * good luck! We've mashed as many of the different incompatible JUnit/xUnit
 * XSDs as possible into one reporter.
 */
export default class JUnit extends Reporter {
  readonly filename: string | undefined;

  constructor(executor: Executor, options: Partial<JUnitProperties> = {}) {
    super(executor, options);
    if (options.filename) {
      this.filename = options.filename;
      if (dirname(this.filename) !== '.') {
        mkdirp(dirname(this.filename));
      }
      this.output = createWriteStream(this.filename);
    }
  }

  @eventHandler()
  runEnd() {
    const rootNode = new XmlNode('testsuites');
    this.executor.suites.forEach(suite => {
      rootNode.childNodes.push(createSuiteNode(suite, this));
    });
    const report =
      '<?xml version="1.0" encoding="UTF-8" ?>' + rootNode.toString() + '\n';
    this.output.end(report);
  }
}

export interface JUnitProperties extends ReporterProperties {
  filename?: string;
}

/**
 * Simple XML generator.
 * @constructor
 * @param {string} nodeName The node name.
 * @param {Object?} attributes Optional attributes.
 */
class XmlNode {
  nodeName = '';
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
   * @param {(XmlNode|string)[]?} childNodes Optional child nodes for the new
   * node.
   * @returns {XmlNode} A new node.
   */
  createNode(nodeName: string, attributes: Object) {
    const node = new XmlNode(nodeName, attributes);
    this.childNodes.push(node);
    return node;
  }

  _escape(str: string) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  _serializeAttributes() {
    const attributes = this.attributes;
    const nodes: any[] = [];

    for (let key in attributes) {
      if (attributes[key] != null) {
        nodes.push(key + '="' + this._escape(attributes[key]) + '"');
      }
    }

    return nodes.length ? ' ' + nodes.join(' ') : '';
  }

  _serializeContent() {
    const nodeList = this.childNodes;
    const nodes: any[] = [];
    for (let i = 0, j = nodeList.length; i < j; ++i) {
      nodes.push(
        typeof nodeList[i] === 'string'
          ? this._escape(nodeList[i])
          : nodeList[i].toString()
      );
    }

    return nodes.join('');
  }

  /**
   * Outputs the node as a serialised XML string.
   * @returns {string}
   */
  toString() {
    const children = this._serializeContent();

    return (
      '<' +
      this.nodeName +
      this._serializeAttributes() +
      (children.length ? '>' + children + '</' + this.nodeName + '>' : '/>')
    );
  }
}

function createSuiteNode(suite: Suite, reporter: JUnit): XmlNode {
  return new XmlNode('testsuite', {
    name: suite.name || 'Node.js',
    failures: suite.numFailedTests,
    skipped: suite.numSkippedTests,
    tests: suite.numTests,
    time: suite.timeElapsed! / 1000,
    childNodes: suite.tests.map(test => createTestNode(test, reporter))
  });
}

function createTestNode(test: Suite | Test, reporter: JUnit) {
  if (isSuite(test)) {
    return createSuiteNode(test, reporter);
  }

  const node = new XmlNode('testcase', {
    name: test.name,
    time: test.timeElapsed! / 1000,
    status: test.error ? 1 : 0
  });

  if (test.error) {
    node.createNode(
      test.error.name === 'AssertionError' ? 'failure' : 'error',
      {
        childNodes: [reporter.formatError(test.error)],
        message: test.error.message,
        type: test.error.name
      }
    );
  } else if (test.skipped != null) {
    node.createNode('skipped', {
      childNodes: [test.skipped]
    });
  }

  return node;
}
