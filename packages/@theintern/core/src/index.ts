/**
 * This is the default public API for Intern. Since most of Intern's public API
 * is accessible through the [[lib/executors/Executor.Executor]] classes, this
 * module simply exports a reference to the global executor instance.
 */ /** */

import NodeExecutor from './lib/executors/Node';
import { Executor } from './lib/executors/Executor';
import { global } from '@theintern/common';

export { Args, Config, DEFAULT_CONFIG, parseArgs } from './lib/config';
export { createConfigurator } from './lib/node';
export { Events } from './lib/executors/Executor';
export { default as object, ObjectSuiteDescriptor, Tests } from './lib/interfaces/object';
export { default as Test, TestFunction } from './lib/Test';
export { default as Suite } from './lib/Suite';
export { default as Remote } from './lib/Remote';
export { default as ProxiedSession } from './lib/ProxiedSession';

const intern = (global.intern = new NodeExecutor());
export default intern;

declare global {
  /**
   * Intern installs an instance of an Executor subclass (Node in Node.js, or
   * Browser in a browser environment) on a global `intern` constant.
   */
  export const intern: Executor;
}
