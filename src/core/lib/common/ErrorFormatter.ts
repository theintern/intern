import { diffJson, Change } from 'diff';

import { InternError } from '../types';
import { Executor } from '../executors/Executor';

export default class ErrorFormatter implements ErrorFormatterProperties {
  readonly executor: Executor;

  constructor(executor: Executor) {
    this.executor = executor;
  }

  /**
   * Generates a full error message from a plain Error object, avoiding
   * duplicate error messages that might be caused by different opinions on
   * what a stack trace should look like.
   *
   * @param error An object describing the error.
   * @returns A string message describing the error.
   */
  format(
    error: string | Error | InternError,
    options?: ErrorFormatOptions
  ): string {
    options = options || {};
    let message: string;

    if (typeof error !== 'string' && (error.message || error.stack)) {
      message =
        (error.name || 'Error') + ': ' + (error.message || 'Unknown error');
      let stack = error.stack;

      if (stack) {
        // V8 puts the original error at the top of the stack too; avoid
        // redundant output that may cause confusion about how many
        // times an assertion was actually called
        if (stack.indexOf(message) === 0) {
          stack = stack.slice(message.length);
        } else if (stack.indexOf(error.message) === 0) {
          stack = stack.slice(String(error.message).length);
        } else if (stack.indexOf('Error\n') === 0) {
          // The stack for errors in Internet Explorer may start with
          // 'Error'
          stack = stack.slice('Error'.length);
        }

        stack = this._normalizeStackTrace(stack);
      }

      const anyError: any = error;

      // Assertion errors may have showDiff, actual, and expected properties
      if (
        (anyError.showDiff &&
          typeof anyError.actual === 'object' &&
          typeof anyError.expected === 'object') ||
        (typeof anyError.actual === 'string' &&
          typeof anyError.expected === 'string')
      ) {
        const diff = this._createDiff(anyError.actual, anyError.expected);
        if (diff) {
          message += '\n\n' + diff + '\n';
        }
      }

      if (stack && /\S/.test(stack)) {
        message += stack;
      } else if (anyError.fileName) {
        // FireFox errors may have fileName, lineNumber, and
        // columnNumber properties
        message += '\n  at ' + anyError.fileName;
        if (anyError.lineNumber != null) {
          message += ':' + anyError.lineNumber;

          if (anyError.columnNumber != null) {
            message += ':' + anyError.columnNumber;
          }
        }

        message += '\nNo stack';
      } else {
        message += '\nNo stack or location';
      }
    } else {
      message = String(error);
    }

    const space = options.space;
    if (space != null) {
      const lines = message.split('\n');
      message = [lines[0]]
        .concat(
          lines.slice(1).map(line => {
            return space + line;
          })
        )
        .join('\n');
    }

    return message;
  }

  protected _getSource(tracepath: string): string {
    if (tracepath === '<anonymous>') {
      return 'anonymous';
    }
    return tracepath;
  }

  /**
   * Creates a unified diff to explain the difference between two objects.
   *
   * @param actual The actual result.
   * @param expected The expected result.
   * @returns A unified diff formatted string representing the difference
   * between the two objects.
   */
  protected _createDiff(actual: string, expected: string): string;
  protected _createDiff(actual: object, expected: object): string;
  protected _createDiff(
    actual: string | object,
    expected: string | object
  ): string {
    // TODO: Remove the casts when the diffJson typings are updated (the
    // current typings are missing the options argument).
    let diff = <Change[]>(<any>diffJson)(actual, expected, {
      undefinedReplacement: null
    });
    if (diff.length === 1 && !diff[0].added && !diff[0].removed) {
      return '';
    }

    return diff.reduce((d, { value, added, removed }) => {
      const lastChar = value[value.length - 1] === '\n' ? '\n' : '';
      const lines = value.split('\n');
      if (lastChar === '\n') {
        lines.pop();
      }
      let prefix = '';
      if (d.length > 0 && d[d.length - 1] !== '\n') {
        prefix = '\n';
      }
      const char = added ? 'E' : removed ? 'A' : ' ';
      return d + `${prefix}${char} ` + lines.join(`\n${char} `) + lastChar;
    }, '');
  }

  /**
   * Return a trace line in a standardized format.
   */
  protected _formatLine(data: { func?: string; source: string }) {
    if (!data.func) {
      return '  @ ' + this._getSource(data.source);
    }
    return '  at ' + data.func + ' @ ' + this._getSource(data.source);
  }

  /**
   * Parse a stack trace, apply any source mappings, and normalize its format.
   */
  protected _normalizeStackTrace(stack: string) {
    let lines = stack.replace(/\s+$/, '').split('\n');
    let firstLine = '';

    // strip leading blank lines
    while (/^\s*$/.test(lines[0])) {
      lines = lines.slice(1);
    }

    let stackLines = /^\s*at /.test(lines[0])
      ? this._processChromeTrace(lines)
      : this._processSafariTrace(lines);

    if (this.executor.config.filterErrorStack) {
      stackLines = stackLines.filter(line => {
        return !(
          /\binternal\/process\//.test(line) ||
          /\bnode_modules\/(?!digdug|leadfoot)/.test(line) ||
          /\/__intern\//.test(line) ||
          /\bModule\.(?:runMain|load)/.test(line) ||
          /\bModule\._\w+/.test(line) ||
          /\bbootstrap_node\.js/.test(line) ||
          /<module.js[:>]/.test(line) ||
          /<anonymous>$/.test(line) ||
          /<native>$/.test(line)
        );
      });
    }

    return '\n' + firstLine + stackLines.join('\n');
  }

  /**
   * Process Chrome, Opera, and IE traces.
   *
   * Ex)
   *   at Object._updateExpressionOptions (AxiomEditor.js:511)
   *   at Object.<anonymous> (AxiomEditor.js:291)
   *   at Function.m.emit (dojo.js.uncompressed.js:8875)
   */
  protected _processChromeTrace(lines: string[]) {
    return lines.map(line => {
      let match: RegExpMatchArray | null;
      if ((match = /^\s*at (.+?) \(([^)]+)\)$/.exec(line))) {
        return this._formatLine({ func: match[1], source: match[2] });
      } else if ((match = /^\s*at (.*)/.exec(line))) {
        return this._formatLine({ source: match[1] });
      } else {
        return line;
      }
    });
  }

  /**
   * Process Safari and Firefox traces.
   *
   * Ex)
   *   _updateExpressionOptions@http://localhost:8080/AxiomEditor.js:511:49
   *   http://localhost:8080/AxiomEditor.js:291:34
   *   dispatchEvent@[native code]
   *   emit@http://ajax.googleapis.com/ajax/libs/dojo/1.12.2/dojo/dojo.js:118:282
   */
  protected _processSafariTrace(lines: string[]) {
    return lines.map(line => {
      let match: RegExpMatchArray | null;
      if ((match = /^([^@]+)@(.*)/.exec(line))) {
        return this._formatLine({ func: match[1], source: match[2] });
      } else if ((match = /^(\w+:\/\/.*)/.exec(line))) {
        return this._formatLine({ source: match[1] });
      } else {
        return line;
      }
    });
  }
}

export interface ErrorFormatterProperties {
  executor: Executor;
}

export interface ErrorFormatOptions {
  space?: string;
}
