import { readFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { MappingItem, SourceMapConsumer } from 'source-map';

import ErrorFormatter from '../common/ErrorFormatter';
import { readSourceMap } from './util';
import Node from '../executors/Node';

export default class NodeErrorFormatter extends ErrorFormatter {
  readonly executor!: Node;

  private fileSourceMaps: { [path: string]: SourceMapConsumer } = {};
  private fileSources: { [path: string]: string } = {};

  constructor(executor: Node) {
    super(executor);
  }

  /**
   * Dereference the source from a traceline.
   */
  protected _getSource(tracepath: string) {
    if (tracepath === '<anonymous>') {
      return 'anonymous';
    }

    let sourcepath = this._getSourceHelper(tracepath);
    while (sourcepath !== tracepath) {
      tracepath = sourcepath;
      sourcepath = this._getSourceHelper(tracepath);
    }

    return tracepath;
  }

  private _getSourceHelper(tracepath: string) {
    let match: RegExpMatchArray | null;
    let source: string | undefined;
    let line: number;
    let col: number | undefined;
    let map: SourceMapConsumer | undefined;
    let originalPos: { source?: string; line: number; column?: number };
    let result: string;

    if (!(match = /^(.*?):(\d+)(:\d+)?$/.exec(tracepath))) {
      // no line or column data
      return tracepath;
    }

    tracepath = match[1];
    line = Number(match[2]);
    col = match[3] ? Number(match[3].substring(1)) : undefined;

    // If the tracepath starts with the server URL, resolve it to something
    // local
    if (tracepath.indexOf(this.executor.config.serverUrl) === 0) {
      tracepath = tracepath.slice(this.executor.config.serverUrl.length);
      tracepath = tracepath.replace(
        /^__intern\//,
        this.executor.config.internPath
      );
    }

    // Make the tracepath absolute since that's how it will be stored in map
    // stores
    tracepath = resolve(tracepath);

    const instrumentedStore = this.executor.instrumentedMapStore;

    // first, check for an instrumentation source map
    if (tracepath in instrumentedStore.data) {
      map = new SourceMapConsumer(instrumentedStore.data[tracepath].data);
      originalPos = this.getOriginalPosition(map, line, col);
      line = originalPos.line;
      col = originalPos.column;
      if (originalPos.source) {
        source = originalPos.source;
      }
    }

    source = source || tracepath;

    // next, check for original source map
    const sourceMapStore = this.executor.sourceMapStore;
    if (source in sourceMapStore.data) {
      map = new SourceMapConsumer(sourceMapStore.data[source].data);
    } else {
      map = this.getSourceMap(source);
    }

    source = relative('.', source);

    if (map) {
      originalPos = this.getOriginalPosition(map, line, col);
      line = originalPos.line;
      col = originalPos.column;
      if (originalPos.source) {
        // If original source starts with ./ or ../, or is just a bare
        // filename, assume it's relative to the current source
        if (
          originalPos.source.indexOf('/') === -1 ||
          /\.\.?\//.test(originalPos.source)
        ) {
          source = join(dirname(source), originalPos.source);
        } else {
          // If not, assume its relative to the project root
          source = originalPos.source;
        }
      }
    }

    // Source should be relative, because that's what we want the user to
    // see
    source = relative('.', source);

    result = source + ':' + line;
    if (col !== null) {
      result += ':' + col;
    }
    return result;
  }

  /**
   * Get the original position of line:column based on map.
   *
   * Assumes mappings are is in order by generatedLine, then by
   * generatedColumn; maps created with SourceMapConsumer.eachMapping should
   * be in this order by default.
   */
  private getOriginalPosition(
    map: SourceMapConsumer,
    line: number,
    column?: number
  ): { line: number; column?: number; source?: string } {
    const originalPosition = map.originalPositionFor({
      line: line,
      column: column!
    });

    // if the SourceMapConsumer was able to find a location, return it
    if (originalPosition.line != null) {
      return originalPosition;
    }

    const entries: MappingItem[] = [];

    // find all map entries that apply to the given line in the generated
    // output
    map.eachMapping(
      entry => {
        if (entry.generatedLine === line) {
          entries.push(entry);
        }
      },
      null,
      SourceMapConsumer.GENERATED_ORDER
    );

    if (entries.length === 0) {
      // no valid mappings exist -- return the line and column arguments
      return { line: line, column: column };
    }

    let position = entries[0];

    // Chrome/Node.js column is at the start of the term that generated the
    // exception IE column is at the beginning of the expression/line with
    // the exceptional term
    //
    // Safari column number is just after the exceptional term
    //   - need to go back one element in the mapping
    //
    // Firefox, PhantomJS have no column number
    //   - for no col number, find the largest original line number for the
    //     generated line

    if (column != null) {
      // find the most likely mapping for the given generated line and
      // column
      let entry: MappingItem;
      for (let i = 1; i < entries.length; i++) {
        entry = entries[i];
        if (
          column > position.generatedColumn &&
          column >= entry.generatedColumn
        ) {
          position = entry;
        }
      }
    }

    return {
      line: position.originalLine,
      column: position.originalColumn,
      source: position.source
    };
  }

  /**
   * Load and process the source map for a given file.
   */
  private getSourceMap(filepath: string) {
    if (filepath in this.fileSourceMaps) {
      return this.fileSourceMaps[filepath];
    }

    try {
      let data: string;

      if (filepath in this.fileSources) {
        data = this.fileSources[filepath];
      } else {
        data = readFileSync(filepath).toString('utf-8');
        this.fileSources[filepath] = data;
      }

      const rawMap = readSourceMap(filepath, data);
      if (rawMap) {
        this.fileSourceMaps[filepath] = new SourceMapConsumer(rawMap);
        return this.fileSourceMaps[filepath];
      }
    } catch (error) {
      // this is normal for files like node.js -- just return null
    }
  }
}
