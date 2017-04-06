// This is a bridge module that loads CommonJS modules from a location relative to this module
// from Intern tests written in UMD. This should be used with an AMD module loader
// and an AMD `map` configuration like the following:
//
// map: {
// 	'tests': {
// 		'src': 'tests/srcLoader!../src',
// 	},
// 	'tests/srcLoader': {
// 		'src': 'src'
// 	}
// }
import { IRequire } from 'dojo/loader';

declare const require: IRequire;

export function normalize(id: string): string {
	return id;
}

export function load(id: string, pluginRequire: IRequire, callback: Function) {
	pluginRequire([ 'dojo/node!' + require.toUrl(id) ], function (module) {
		callback(module);
	});
}
