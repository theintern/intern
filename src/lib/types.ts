import Test from './Test';

export interface InternError {
  name: string;
  message: string;
  stack?: string;
  showDiff?: boolean;
  actual?: any;
  expected?: any;
  relatedTest?: Test;
  reported?: boolean;
}

export type RuntimeEnvironment = 'node' | 'browser';
