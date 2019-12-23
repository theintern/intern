import Test from './Test';
import { LifecycleMethod } from './Suite';

export interface InternError {
  name: string;
  message: string;
  stack?: string;
  showDiff?: boolean;
  actual?: any;
  expected?: any;
  lifecycleMethod?: LifecycleMethod;
  relatedTest?: Test;
  reported?: boolean;
}

export type RuntimeEnvironment = 'node' | 'browser';
