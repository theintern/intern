/**
 * AMD plugin API interface for easy loading of chai assertion interfaces.
 */

import * as chai from 'chai';
import { IRequire } from 'dojo/loader';

// Ensure that chai-generated errors always include a stack
chai.config.includeStack = true;

export function load(id: string, _pluginRequire: IRequire, callback: Function) {
	if (!id) {
		callback(chai);
		return;
	}

	const iface: any = (<any> chai)[id];

	if (!iface) {
		throw new Error('Invalid chai interface "' + id + '"');
	}

	if (!iface.AssertionError) {
		iface.AssertionError = chai.AssertionError;
	}

	callback(iface);
}

export function normalize(id: string) {
	return id;
}
