import { AmdRequire } from './util';
import { delegate } from 'dojo/lang';
import Promise = require('dojo/Promise');
import has = require('dojo/has');
import { escapeRegExp, getDefault } from './util';
import _pathUtilType = require('path');

if (has('host-node')) {
	/* tslint:disable:no-var-keyword */
	var pathUtil: typeof _pathUtilType = require('path');
	/* tslint:enable:no-var-keyword */
}

function getGlobal(): any {
	return (1, eval)('this');
}

function getRelativeError(moduleId: string) {
	return new Error('Relative module IDs like "' + moduleId + '" can only be resolved by passing the require function from the requesting module. Replace loader.import(moduleId) with loader.import(moduleId, require).');
}

interface Config {
	baseUrl?: string;
	config?: {
		[moduleId: string]: {};
	};
	map?: { [prefix: string]: { [moduleId: string]: string; }; };
	packages?: Array<{ name: string; location: string; main?: string; } | string>;
	paths?: { [prefix: string]: string; };
	shim?: {
		[moduleId: string]: {
			deps?: string[];
			exports?: string;
			init?(...modules: any[]): any;
		} | string[];
	};
}

interface AmdDefine {
	(factory: (require: AmdRequire, exports: {}, module: { id: string; }) => void): void;
	(deps: string[], factory: (...args: any[]) => void): void;
	amd: {
		vendor?: string;
	};
}

interface AmdPlugin {
	load(resourceId: string, parentRequire: AmdRequire, callback: (value: any) => void): void;
	normalize?(resourceId: string, normalize: (resourceId: string) => string): string;
}

type WorkerImport = typeof importScripts;
export type Retriever = NodeRequire | HTMLDocument | WorkerImport;

export interface Loader {
	import<T>(moduleId: string, parent?: NodeRequire | AmdRequire, returnDefault?: boolean): Promise<T>;
	purgeCache(): Promise<void>;
}

/*
To generate an AMD loader by calling AmdLoader.create:

1. Loader already exists at global.require, source = null
   - Create new AmdLoader instance wrapping existing loader at global.require
2. Loader does not exist
   - Inject source
   - Create new AmdLoader instance wrapping loader retrieved by injection

When create new AmdLoader instance runs:

1. Configure the loader with the passed configuration data
2. If the loader returns a new context from configuration, this means purging does not require reloading from scratch;
   set purgeable flag. Otherwise do not set purgeable flag. Store the original (top-level) loader for reference by purge.

When import runs:

1. Use the loader instance created by context to load new module

When purgeCache runs:

1a. If the loader has purgeable flag, re-run root loader configuration with fresh context ID and reset internal loader slot
    with new context loader.
1b. Otherwise, delete the global loader and reinject it (this means that the source, config, retriever must all be passed)
1b2. If no source is available then throw.
*/

export class AmdLoader implements Loader {
	static create(source: string, config: Config, retriever: Retriever) {
		if (!has('host-node') && !has('host-browser') && !has('host-worker')) {
			return Promise.reject(new Error('Host environment is not implemented. Please open a ticket at https://github.com/theintern/intern/issues to add support for your execution environment.'));
		}

		const global: any = getGlobal();

		// Use an existing loader, or throw an error
		if (!source) {
			if (!global.require) {
				return Promise.reject(new Error('Cannot create an AMD loader out of thin air. Please ensure an AMD loader already exists in the environment, or pass a source path to an AMD loader.'));
			}

			return Promise.resolve(new AmdLoader(global.require, config, source, retriever));
		}
		else {
			// TODO: Store for future restoration?
			delete global.require;
			delete global.define;
		}

		return AmdLoader.injectGlobalLoader(source, retriever).then(function (loader: AmdRequire) {
			return new AmdLoader(loader, config, source, retriever);
		});
	}

	static injectGlobalLoader(source: string, require: NodeRequire): Promise<AmdRequire>;
	static injectGlobalLoader(source: string, document: HTMLDocument): Promise<AmdRequire>;
	static injectGlobalLoader(source: string, importScripts: WorkerImport): Promise<AmdRequire>;
	static injectGlobalLoader(source: string, retriever: Retriever): Promise<AmdRequire>;
	static injectGlobalLoader(source: string, retriever: Retriever): Promise<AmdRequire> {
		function getSourceError() {
			return new Error('After successful injection, no AMD loader could be found in the environment. Please verify that "' + source + '" actually provides an AMD-compliant loader.');
		}

		return new Promise<AmdRequire>(function (resolve, reject) {
			if (has('host-node')) {
				const require = <NodeRequire> retriever;
				let loader: AmdRequire = require(source);
				if (!loader) {
					loader = getGlobal().require;
				}

				if (loader) {
					resolve(loader);
				}
				else {
					reject(getSourceError());
				}
			}
			else if (has('host-browser')) {
				const document = <HTMLDocument> retriever;

				interface CorsHTMLScriptElement extends HTMLScriptElement {
					crossOrigin?: string;
				}

				const script: CorsHTMLScriptElement = document.createElement('script');
				script.crossOrigin = 'anonymous';
				script.src = source;
				script.onload = function () {
					const loader: AmdRequire = getGlobal().require;
					if (loader) {
						resolve(loader);
					}
					else {
						reject(getSourceError());
					}
				};
			}
			else if (has('host-worker')) {
				const importScripts = <WorkerImport> retriever;
				importScripts(source);
				const loader = getGlobal().require;
				if (loader) {
					resolve(loader);
				}
				else {
					reject(getSourceError());
				}
			}
		});
	}

	private config: Config;
	private loader: AmdRequire;
	private rootLoader: AmdRequire;
	private source: string;
	private retriever: Retriever;

	private disposableLoader = false;

	constructor(loader: AmdRequire, config: Config, source: string, retriever: Retriever) {
		this.rootLoader = loader;
		this.loader = this.initialiseLoader(loader, config);
		this.disposableLoader = this.rootLoader !== this.loader;
		this.config = config;
		this.source = source;
		this.retriever = retriever;
	}

	import<T>(moduleId: string, parent?: AmdRequire, returnDefault = true) {
		if (!parent && moduleId[0] === '.') {
			return Promise.reject(getRelativeError(moduleId));
		}

		const require = parent || this.loader;
		return new Promise<T>(function (resolve, reject) {
			require([ moduleId ], function (value) {
				if (returnDefault) {
					value = getDefault(value);
				}

				resolve(value);
			}, reject);
		});
	}

	private initialiseLoader(loader: AmdRequire, config: Config) {
		if (loader.config) {
			let contextLoader: AmdRequire = loader.config(delegate(config, { context: String(Date.now()) }));
			if (contextLoader) {
				return contextLoader;
			}
		}
		else {
			loader(config);
		}

		return loader;
	}

	purgeCache() {
		if (this.disposableLoader) {
			this.initialiseLoader(this.rootLoader, this.config);
			return Promise.resolve(undefined);
		}
		else if (this.source) {
			const self = this;
			AmdLoader.injectGlobalLoader(this.source, this.retriever).then(function (loader) {
				self.rootLoader = loader;
				self.loader = self.initialiseLoader(loader, self.config);
			});
		}
		else {
			return Promise.reject(new Error('This AMD loader does not support disposable contexts and was created from an object that already existed in the environment, so it cannot be purged.'));
		}
	}
}

interface ModuleRemap {
	length: number;
	matcher: RegExp;
	replacement: string;
}

export class NodeLoader implements Loader {
	private Module: {
		_extensions: { [extension: string]: (module: NodeModule, filename: string) => void; };
		_resolveFilename(request: string, parent?: NodeModule): string;
	};

	private loader: NodeRequire;
	private imports: { [filename: string]: boolean; } = {};

	private baseUrl: string;
	private packages: { length: number; matcher: RegExp; location: string; main: string; }[];
	private paths: ModuleRemap[];
	private maps: { length: number; matcher: RegExp; replacements: ModuleRemap[]; }[];

	constructor(config: Config, loader: NodeRequire) {
		this.loader = loader;
		this.Module = loader('module');
		this.overrideExtensionLoader();
		this.overrideResolveFilename();

		function mapPaths(paths: { [sourcePath: string]: string; }): ModuleRemap[] {
			const remaps: ModuleRemap[] = [];
			for (const sourcePath in paths) {
				remaps.push({
					length: sourcePath.length,
					matcher: new RegExp('^' + escapeRegExp(sourcePath) + '(?:\/|$)'),
					replacement: paths[sourcePath]
				});
			}
			remaps.sort(function (a, b) {
				return b.length - a.length;
			});
			return remaps;
		}

		this.baseUrl = config.baseUrl || './';

		if (config.packages) {
			const packages: typeof NodeLoader.prototype.packages = [];
			for (const definition of config.packages) {
				if (typeof definition === 'string') {
					packages.push({
						length: definition.length,
						matcher: new RegExp('^' + definition + '(?:\/|$)'),
						location: definition,
						main: 'main'
					});
				}
				else {
					packages.push({
						length: definition.name.length,
						matcher: new RegExp('^' + definition.name + '(?:\/|$)'),
						location: definition.location,
						main: definition.main || 'main'
					});
				}
			}
			packages.sort(function (a, b) {
				return b.length - a.length;
			});
			this.packages = packages;
		}

		if (config.paths) {
			this.paths = mapPaths(config.paths);
		}

		if (config.map) {
			const maps: typeof NodeLoader.prototype.maps = [];
			for (const sourceModuleId in config.map) {
				if (sourceModuleId === '*') {
					maps.push({
						length: 0,
						matcher: new RegExp('.*'),
						replacements: mapPaths(config.map[sourceModuleId])
					});
				}
				else {
					maps.push({
						length: sourceModuleId.length,
						matcher: new RegExp('^' + escapeRegExp(sourceModuleId) + '(?:\/|$)'),
						replacements: mapPaths(config.map[sourceModuleId])
					});
				}
			}
			maps.sort(function (a, b) {
				return b.length - a.length;
			});

			this.maps = maps;
		}
	}

	import<T>(moduleId: string, parent?: NodeRequire, returnDefault = true) {
		// Wrapping in Promise constructors instead of Promise.resolve in this
		// function is to ensure any thrown errors are passed to the caller
		// through the promise, instead of generating an exception.

		if (!parent && moduleId[0] === '.') {
			return Promise.reject(getRelativeError(moduleId));
		}

		const require = parent || this.loader;
		const self = this;
		return new Promise<T>(function (resolve) {
			let value = require(moduleId);
			self.imports[require.resolve(moduleId)] = true;
			if (returnDefault) {
				value = getDefault(value);
			}
			resolve(value);
		});
	}

	private overrideExtensionLoader() {
		const require = this.loader;
		const Module = this.Module;
		Module._extensions['.amdplugin'] = function (module: NodeModule, filename: string) {
			const moduleIds = /^([^!]*)!(.*)$/.exec(filename.slice(0, -'.amdplugin'.length));
			if (!moduleIds) {
				throw new Error('Unparseable plugin module ID "' + filename + '". Plugin module IDs should be in the form "pluginId!resourceData".');
			}

			const plugin: AmdPlugin = require(moduleIds[1]);

			let resourceId = moduleIds[2];
			if (plugin.normalize) {
				resourceId = plugin.normalize(resourceId, (id: string) => id);
			}

			function fakeParentRequire(deps: string[], callback: Function) {
				callback.apply(null, deps.map((moduleId) => module.parent ? module.parent.require(moduleId) : require));
			}

			let callbackInvoked = false;
			function loadCallback(value: any) {
				module.exports = value;
				callbackInvoked = true;
			}

			plugin.load(resourceId, <AmdRequire> fakeParentRequire, loadCallback);

			if (!callbackInvoked) {
				throw new Error('Due to the design limitations of the Node.js module system, only synchronously-resolving plugins can be used without installing a real AMD loader.');
			}
		};
	}

	private overrideResolveFilename() {
		const Module = this.Module;
		const defaultResolver = Module._resolveFilename;
		const self = this;
		Module._resolveFilename = function (request: string, parent: NodeModule) {
			if (request.indexOf('!') !== -1) {
				return request + '.amdplugin';
			}
			else {
				if (self.maps) {
					mapping:
					for (const map of self.maps) {
						if (map.matcher.test(parent ? parent.id : '')) {
							for (const source of map.replacements) {
								if (source.matcher.test(request)) {
									request = pathUtil.join(source.replacement, request.slice(source.length));
									break mapping;
								}
							}
						}
					}
				}

				if (self.packages) {
					for (const definition of self.packages) {
						if (definition.matcher.test(request)) {
							if (request.length === definition.length) {
								request = pathUtil.join(definition.location, definition.main);
							}
							else {
								request = pathUtil.join(definition.location, request.slice(definition.length));
							}

							break;
						}
					}
				}

				if (self.paths) {
					let pathRemapped = false;
					for (const path of self.paths) {
						if (path.matcher.test(request)) {
							pathRemapped = true;
							request = pathUtil.join(path.replacement, request.slice(path.length));
							break;
						}
					}

					if (pathRemapped) {
						if (!pathUtil.isAbsolute(request)) {
							request = pathUtil.join(self.baseUrl, request);
						}

						if (request.slice(-3) !== '.js') {
							request += '.js';
						}

						return request;
					}
				}

				return defaultResolver.call(this, request, parent);
			}
		};
	}

	purgeCache() {
		function purge(module: NodeModule) {
			if (module) {
				module.children.forEach(purge);
				delete loaderCache[module.filename];
			}
		}

		const loaderCache = this.loader.cache;
		for (const filename in this.imports) {
			purge(loaderCache[filename]);
		}

		this.imports = {};

		return Promise.resolve(undefined);
	}
}
