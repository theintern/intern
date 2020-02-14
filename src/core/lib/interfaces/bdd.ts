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
