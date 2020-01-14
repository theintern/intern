/**
 * This is the default public API for Intern. Since most of Intern's public API
 * is accessible through the [[lib/executors/Executor.Executor]] classes, this
 * module simply exports a reference to the global executor instance.
 */ /** */

import NodeExecutor from './lib/executors/Node';
import { global } from '../common';

const intern = (global.intern = new NodeExecutor());
export default intern;

declare global {
  /**
   * Intern installs an instance of an Executor subclass (Node in Node.js, or
   * Browser in a browser environment) on a global `intern` constant.
   */
  export const intern: NodeExecutor;
}
