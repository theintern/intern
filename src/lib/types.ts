import Test from './Test';

export interface InternError {
	name: string;
	message: string;
	stack?: string;
	showDiff?: boolean;
	actual?: any;
	expected?: any;
	relatedTest?: Test;
}

export type RuntimeEnvironment = 'node' | 'browser';
