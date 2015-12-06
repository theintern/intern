import chai = require('chai');
import { AmdRequire } from './lib/util';

// ensure that chai-generated errors always include a stack
chai.config.includeStack = true;

export function load(id: string, parentRequire: AmdRequire, callback: (value: any) => void) {
	if (!id) {
		callback(chai);
		return;
	}

	const api: any = (<any> chai)[id];

	if (!api) {
		throw new Error('Invalid chai interface "' + id + '"');
	}

	if (!api.AssertionError) {
		api.AssertionError = chai.AssertionError;
	}

	callback(api);
}

export function normalize(id: string) {
	return id;
}
