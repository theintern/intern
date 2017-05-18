import { InternError } from '../types';
import { diffJson } from 'diff';

export default class ErrorFormatter implements ErrorFormatterProperties {
	filterErrorStack = false;

	constructor(options: ErrorFormatterOptions = {}) {
		this.filterErrorStack = options.filterErrorStack || false;
	}

	/**
	 * Generates a full error message from a plain Error object, avoiding duplicate error messages that might be
	 * caused by different opinions on what a stack trace should look like.
	 *
	 * @param error An object describing the error.
	 * @returns A string message describing the error.
	 */
	format(error: string | Error | InternError, options?: ErrorFormatOptions): string {
		options = options || {};
		let message: string;

		if (typeof error !== 'string' && (error.message || error.stack)) {
			message = (error.name || 'Error') + ': ' + (error.message || 'Unknown error');
			let stack = error.stack;

			if (stack) {
				// V8 puts the original error at the top of the stack too; avoid redundant output that may
				// cause confusion about how many times an assertion was actually called
				if (stack.indexOf(message) === 0) {
					stack = stack.slice(message.length);
				}
				else if (stack.indexOf(error.message) === 0) {
					stack = stack.slice(String(error.message).length);
				}

				stack = this._normalizeStackTrace(stack);
			}

			const anyError: any = error;

			if (anyError.showDiff && typeof anyError.actual === 'object' && typeof anyError.expected === 'object') {
				const diff = this._createDiff(anyError.actual, anyError.expected);
				if (diff) {
					message += '\n\n' + diff + '\n';
				}
			}

			if (stack && /\S/.test(stack)) {
				message += stack;
			}
			else if (anyError.fileName) {
				message += '\n  at ' + anyError.fileName;
				if (anyError.lineNumber != null) {
					message += ':' + anyError.lineNumber;

					if (anyError.columnNumber != null) {
						message += ':' + anyError.columnNumber;
					}
				}

				message += '\nNo stack';
			}
			else {
				message += '\nNo stack or location';
			}
		}
		else {
			message = String(error);
		}

		const space = options.space;
		if (space != null) {
			message = message.split('\n').map(line => {
				return space + line;
			}).join('\n');
		}

		return message;
	}

	protected _getSource(tracepath: string): string {
		return tracepath;
	}

	/**
	 * Creates a unified diff to explain the difference between two objects.
	 *
	 * @param actual The actual result.
	 * @param expected The expected result.
	 * @returns A unified diff formatted string representing the difference between the two objects.
	 */
	protected _createDiff(actual: Object, expected: Object): string {
		let diff = diffJson(actual, expected);
		if (diff.length === 1 && !diff[0].added && !diff[0].removed) {
			return '';
		}

		return diff.reduce((d, { value, added, removed }) => {
			const lastChar = value[value.length - 1] === '\n' ? '\n' : '';
			const lines = value.split('\n');
			if (lastChar === '\n') {
				lines.pop();
			}
			const char = added ? 'E' : removed ? 'A' : ' ';
			return d + `${char} ` + lines.join(`\n${char} `) + lastChar;
		}, '');
	}

	/**
	 * Return a trace line in a standardized format.
	 */
	protected _formatLine(data: { func?: string, source: string }) {
		if (!data.func) {
			return '  at <' + this._getSource(data.source) + '>';
		}
		return '  at ' + data.func + '  <' + this._getSource(data.source) + '>';
	}

	/**
	 * Parse a stack trace, apply any source mappings, and normalize its format.
	 */
	protected _normalizeStackTrace(stack: string) {
		let lines = stack.replace(/\s+$/, '').split('\n');
		let firstLine = '';

		if (/^(?:[A-Z]\w+)?Error: /.test(lines[0])) {
			// ignore the first line if it's just the Error name
			firstLine = lines[0] + '\n';
			lines = lines.slice(1);
		}

		// strip leading blank lines
		while (/^\s*$/.test(lines[0])) {
			lines = lines.slice(1);
		}

		let stackLines = /^\s*at /.test(lines[0]) ? this._processChromeTrace(lines) : this._processSafariTrace(lines);

		if (this.filterErrorStack) {
			stackLines = stackLines.filter(line => {
				return !(
					/internal\/process\//.test(line) ||
					/node_modules\/(?!digdug|leadfoot)/.test(line) ||
					/Module\.runMain/.test(line) ||
					/bootstrap_node\.js/.test(line)
				);
			});
		}

		return '\n' + firstLine + stackLines.join('\n');
	}

	/**
	 * Process Chrome, Opera, and IE traces.
	 */
	protected _processChromeTrace(lines: string[]) {
		return lines.map(line => {
			let match: RegExpMatchArray | null;
			if ((match = /^\s*at (.+?) \(([^)]+)\)$/.exec(line))) {
				return this._formatLine({ func: match[1], source: match[2] });
			}
			else if ((match = /^\s*at (.*)/.exec(line))) {
				return this._formatLine({ source: match[1] });
			}
			else {
				return line;
			}
		});
	}

	/**
	 * Process Safari and Firefox traces.
	 */
	protected _processSafariTrace(lines: string[]) {
		return lines.map(line => {
			let match: RegExpMatchArray | null;
			if ((match = /^([^@]+)@(.*)/.exec(line))) {
				return this._formatLine({ func: match[1], source: match[2] });
			}
			else if ((match = /^(\w+:\/\/.*)/.exec(line))) {
				return this._formatLine({ source: match[1] });
			}
			else {
				return line;
			}
		});
	}
}

export interface ErrorFormatterProperties {
	filterErrorStack: boolean;
}

export type ErrorFormatterOptions = Partial<ErrorFormatterProperties>;

export interface ErrorFormatOptions {
	space?: string;
}
