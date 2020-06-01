/**
 * This is the BDD interface for registering suites. Typically it will be
 * accessed using [[lib/executors/Executor.Executor.getPlugin]], like:
 *
 * ```js
 * const { describe, it } = intern.getPlugin('interface.bdd');
 * ```
 *
 * It may also be imported as a module, like
 *
 * ```js
 * import { describe, it } from 'intern/lib/interfaces/bdd';
 * ```
 *
 * Suites (`describe`) are registered using callback functions, and tests (`it`) can be registered
 * within the suite callbacks.
 *
 * ```js
 * describe('foo', () => {
 *     before(() => { ... });
 *     afterEach(() => { ... });
 *     it('should bar', () => { ... });
 *     it('should baz', () => { ... });
 * });
 */ /** */
import { Executor } from '../executors/Executor';
import { TestProperties } from '../Test';
import {
  TddLifecycleInterface,
  TddSuiteFactory,
  getInterface as getTddInterface,
  suite,
  xsuite,
  test,
  xtest,
  before,
  after,
  beforeEach,
  afterEach
} from './tdd';

export interface BddInterface extends TddLifecycleInterface {
  describe(name: string, factory: TddSuiteFactory): void;
  xdescribe(name: string, factory: TddSuiteFactory): void;
  it(name: string, test: TestProperties['test']): void;
  xit(name: string, test?: TestProperties['test']): void;
}

export { suite as describe };
export { xsuite as xdescribe };
export { test as it };
export { xtest as xit };
export { before, after, beforeEach, afterEach };

export function getInterface(executor: Executor): BddInterface {
  const {
    suite,
    xsuite,
    test,
    xtest,
    before,
    after,
    beforeEach,
    afterEach
  } = getTddInterface(executor);

  return {
    describe: suite,
    xdescribe: xsuite,
    it: test,
    xit: xtest,
    before,
    after,
    beforeEach,
    afterEach
  };
}
