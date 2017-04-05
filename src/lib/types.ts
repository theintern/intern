import Test from './Test';

export interface InternError {
	name: string;
	message: string;
	stack?: string;
	showDiff?: boolean;
	actual?: string;
	expected?: string;
	relatedTest?: Test;
}
