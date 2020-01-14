/**
 * This is the TDD interface for registering suites. Typically it will be
 * accessed using [[lib/executors/Executor.Executor.getInterface]], like:
 *
 * ```js
 * const { suite, test } = intern.getInterface('tdd');
 * ```
 *
 * It may also be imported as a module, like
 *
 * ```js
 * import { suite, test } from 'intern/lib/interfaces/tdd';
 * ```
 *
 * Suites are registered using callback functions, and tests can be registered
 * within the suite callbacks.
 *
 * ```js
 * suite('foo', () => {
 *     before(() => { ... });
 *     afterEach(() => { ... });
 *     test('bar', () => { ... });
 *     test('baz', () => { ... });
 * });
 */ /** */
import { global } from '../../../common';
import Suite, {
  SuiteProperties,
  SuiteLifecycleFunction,
  TestLifecycleFunction
} from '../Suite';
import Test, { TestProperties } from '../Test';
import { Executor } from '../executors/Executor';

export interface TddInterface extends TddLifecycleInterface {
  suite(name: string, factory: TddSuiteFactory): void;
  test(name: string, test: TestProperties['test']): void;
}

export interface TddLifecycleInterface {
  before(fn: SuiteProperties['before']): void;
  after(fn: SuiteProperties['after']): void;
  beforeEach(fn: SuiteProperties['beforeEach']): void;
  afterEach(fn: SuiteProperties['afterEach']): void;
}

export type TddSuiteFactory = (suite: Suite) => void;

export function suite(name: string, factory: TddSuiteFactory) {
  return _suite(global.intern, name, factory);
}

export function test(name: string, test: TestProperties['test']) {
  if (!currentSuite) {
    throw new Error('A test must be declared within a suite');
  }
  currentSuite.add(new Test({ name, test }));
}

export function before(fn: SuiteProperties['before']) {
  if (!currentSuite) {
    throw new Error('A suite lifecycle method must be declared within a suite');
  }
  aspect(currentSuite, 'before', fn!);
}

export function after(fn: SuiteProperties['after']) {
  if (!currentSuite) {
    throw new Error('A suite lifecycle method must be declared within a suite');
  }
  aspect(currentSuite, 'after', fn!);
}

export function beforeEach(fn: SuiteProperties['beforeEach']) {
  if (!currentSuite) {
    throw new Error('A suite lifecycle method must be declared within a suite');
  }
  aspect(currentSuite, 'beforeEach', fn!);
}

export function afterEach(fn: SuiteProperties['afterEach']) {
  if (!currentSuite) {
    throw new Error('A suite lifecycle method must be declared within a suite');
  }
  aspect(currentSuite, 'afterEach', fn!);
}

export function getInterface(executor: Executor): TddInterface {
  return {
    suite(name: string, factory: TddSuiteFactory) {
      return _suite(executor, name, factory);
    },

    test,
    before,
    after,
    beforeEach,
    afterEach
  };
}

let currentSuite: Suite | null;

function registerSuite(name: string, factory: TddSuiteFactory) {
  const parent = currentSuite!;

  currentSuite = new Suite({ name, parent });
  parent.add(currentSuite);

  factory(currentSuite);

  currentSuite = parent;
}

function _suite(executor: Executor, name: string, factory: TddSuiteFactory) {
  if (!currentSuite) {
    executor.addSuite(parent => {
      currentSuite = parent;
      registerSuite(name, factory);
      currentSuite = null;
    });
  } else {
    registerSuite(name, factory);
  }
}

function aspect(
  suite: Suite,
  method: 'before' | 'after' | 'beforeEach' | 'afterEach',
  callback: SuiteLifecycleFunction | TestLifecycleFunction
) {
  const originalMethod = suite[method] as (
    this: Suite,
    firstArg: Suite | Test
  ) => void;
  suite[method] = function(...args: [Suite | Test]) {
    const originalReturn = originalMethod
      ? originalMethod.apply(suite, args)
      : undefined;
    return Promise.resolve(originalReturn).then(() =>
      (callback as typeof originalMethod).apply(currentSuite as Suite, args)
    );
  };
}
