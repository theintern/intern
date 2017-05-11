import BaseFormatter from '../common/Formatter';
import { readFileSync } from 'fs';
import { parse } from 'url';
import { dirname, join, relative, resolve } from 'path';
import { MappingItem, RawSourceMap, SourceMapConsumer } from 'source-map';
import { readSourceMap } from './util';

export default class Formatter extends BaseFormatter {
	/**
	 * Dereference the source from a traceline.
	 */
	protected _getSource(tracepath: string) {
		let match: RegExpMatchArray | null;
		let source: string;
		let line: number;
		let col: number | undefined;
		let map: SourceMapConsumer | undefined;
		let originalPos: { source?: string, line: number, column?: number };
		let result: string;

		if (tracepath === '<anonymous>') {
			return 'anonymous';
		}

		if (!(match = /^(.*?):(\d+)(:\d+)?$/.exec(tracepath))) {
			// no line or column data
			return tracepath;
		}

		tracepath = match[1];
		line = Number(match[2]);
		col = match[3] ? Number(match[3].substring(1)) : undefined;

		// resolve URLs to a filesystem path
		tracepath = resolve(parse(tracepath).pathname);

		source = relative('.', tracepath);

		// first, check for an instrumentation source map
		if (tracepath in instrumentationSourceMap) {
			map = instrumentationSourceMap[tracepath];
			originalPos = getOriginalPosition(map, line, col);
			line = originalPos.line;
			col = originalPos.column;
			if (originalPos.source) {
				source = originalPos.source;
			}
		}

		// next, check for original source map
		if ((map = getSourceMap(tracepath))) {
			originalPos = getOriginalPosition(map, line, col);
			line = originalPos.line;
			col = originalPos.column;
			if (originalPos.source) {
				source = join(dirname(source), originalPos.source);
			}
		}

		result = source + ':' + line;
		if (col !== null) {
			result += ':' + col;
		}
		return result;
	}
}

let instrumentationSourceMap: { [path: string]: SourceMapConsumer } = {};
let fileSourceMaps: { [path: string]: SourceMapConsumer } = {};
let fileSources: { [path: string]: string } = {};

/**
 * Get the original position of line:column based on map.
 *
 * Assumes mappings are is in order by generatedLine, then by generatedColumn; maps created with
 * SourceMapConsumer.eachMapping should be in this order by default.
 */
function getOriginalPosition(map: any, line: number, column?: number): { line: number, column?: number, source?: string } {
	let originalPosition = map.originalPositionFor({ line: line, column: column });

	// if the SourceMapConsumer was able to find a location, return it
	if (originalPosition.line !== null) {
		return originalPosition;
	}

	const entries: MappingItem[] = [];

	// find all map entries that apply to the given line in the generated output
	map.eachMapping(function (entry: MappingItem) {
		if (entry.generatedLine === line) {
			entries.push(entry);
		}
	}, null, map.GENERATED_ORDER);

	if (entries.length === 0) {
		// no valid mappings exist -- return the line and column arguments
		return { line: line, column: column };
	}

	originalPosition = entries[0];

	// Chrome/Node.js column is at the start of the term that generated the exception
	// IE column is at the beginning of the expression/line with the exceptional term
	// Safari column number is just after the exceptional term
	//   - need to go back one element in the mapping
	// Firefox, PhantomJS have no column number
	//   - for no col number, find the largest original line number for the generated line

	if (column != null) {
		// find the most likely mapping for the given generated line and column
		let entry: MappingItem;
		for (let i = 1; i < entries.length; i++) {
			entry = entries[i];
			if (column > originalPosition.generatedColumn && column >= entry.generatedColumn) {
				originalPosition = entry;
			}
		}
	}

	return {
		line: originalPosition.originalLine,
		column: originalPosition.originalColumn,
		source: originalPosition.source
	};
}

/**
 * Load and process the source map for a given file.
 */
function getSourceMap(filepath: string) {
	if (filepath in fileSourceMaps) {
		return fileSourceMaps[filepath];
	}

	try {
		let data: string;

		if (filepath in fileSources) {
			data = fileSources[filepath];
		}
		else {
			data = readFileSync(filepath).toString('utf-8');
			fileSources[filepath] = data;
		}

		const rawMap = <RawSourceMap>readSourceMap(filepath, data);
		if (rawMap) {
			fileSourceMaps[filepath] = new SourceMapConsumer(rawMap);
			return fileSourceMaps[filepath];
		}
	}
	catch (error) {
		// this is normal for files like node.js -- just return null
	}
}
