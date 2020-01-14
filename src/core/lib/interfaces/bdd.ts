import { Executor } from '../executors/Executor';
import { TestProperties } from '../Test';
import {
  TddLifecycleInterface,
  TddSuiteFactory,
  getInterface as getTddInterface,
  suite,
  test,
  before,
  after,
  beforeEach,
  afterEach
} from './tdd';

export interface BddInterface extends TddLifecycleInterface {
  describe(name: string, factory: TddSuiteFactory): void;
  it(name: string, test: TestProperties['test']): void;
}

export { suite as describe };
export { test as it };
export { before, after, beforeEach, afterEach };

export function getInterface(executor: Executor): BddInterface {
  const { suite, test, before, after, beforeEach, afterEach } = getTddInterface(
    executor
  );

  return {
    describe: suite,
    it: test,
    before,
    after,
    beforeEach,
    afterEach
  };
}
