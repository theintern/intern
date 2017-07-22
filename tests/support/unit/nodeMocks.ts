import { createMock } from './mocks';

import * as fs from 'fs';
import * as path from 'path';
import { mixin, assign } from '@dojo/core/lang';

export type StatType = 'file' | 'directory';
export type StatCallback = (error: Error | undefined, stats: MockStats) => void;

export class MockStats {
	path: string;
	type: StatType | undefined;
	mtime: {
		getTime: () => number;
		toUTCString: () => string;
	};

	constructor(path: string, type?: StatType) {
		this.path = path;
		this.type = type;
		this.mtime = {
			getTime() {
				return 0;
			},
			toUTCString() {
				return 'now';
			}
		};
	}

	isFile() {
		return this.type === 'file';
	}

	isDirectory() {
		return this.type === 'directory';
	}
}

export type FileData = { [name: string]: { type: StatType, data: string } | undefined };
export type FsCallback = (error: Error | undefined, data: string | undefined) => {};
export type MockFsProperties = { [P in keyof typeof fs]?: typeof fs[P] };
export type MockFs = typeof fs & { __fileData: FileData };

export function mockFs(
	fileData: FileData = Object.create(null),
	properties: MockFsProperties = {}
) {
	function missingFile(path: string) {
		return assign(
			new Error(`Error: ENOENT: no such file or directory stat '${path}' errno -2`),
			{
				code: 'ENOENT',
				errno: -2,
				syscall: 'stat',
				path
			}
		);
	}

	const mock = createMock<MockFs>(mixin({
		__fileData: fileData,

		stat(path: string, callback: StatCallback) {
			const entry = mock.__fileData[path];
			if (!entry) {
				callback(missingFile(path), new MockStats(path, undefined));
			}
			else {
				callback(undefined, new MockStats(path, entry.type));
			}
		},

		readFile(path: string, _encoding: string, callback: FsCallback) {
			const entry = mock.__fileData[path];
			if (!entry) {
				callback(missingFile(path), undefined);
			}
			else {
				callback(undefined, entry.data);
			}
		}
	}, properties));
	return mock;
}

export function mockPath(properties: { [P in keyof typeof path]?: typeof path[P] } = {}) {
	return createMock<typeof path>(mixin({
		resolve(path: string) {
			// Normalize fake directory names by adding a trailing '/'
			if (!(/\.\w+$/.test(path)) && path[path.length - 1] !== '/') {
				return path + '/';
			}
			return path;
		},

		join(...args: any[]) {
			return path.join(...args);
		},

		basename(base: string, ...args: any[]) {
			return path.basename(base, ...args);
		},

		normalize(base: string, ...args: any[]) {
			return path.normalize(base, ...args);
		}
	}, properties));
}
