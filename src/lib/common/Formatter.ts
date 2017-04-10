import { InternError } from '../types';
import { createDiff } from './util';
import { mixin } from '@dojo/core/lang';

export default class Formatter implements FormatterProperties {
	filterErrorStack = false;

	constructor(options: FormatterOptions = {}) {
		mixin(this, options);
	}

	/**
	 * Generates a full error message from a plain Error object, avoiding duplicate error messages that might be
	 * caused by different opinions on what a stack trace should look like.
	 *
	 * @param error An object describing the error.
	 * @returns A string message describing the error.
	 */
	format(error: string | Error | InternError, options?: FormatOptions): string {
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

				stack = normalizeStackTrace(stack, this.filterErrorStack, this._getSource);
			}

			const anyError: any = error;

			if (anyError.showDiff && typeof anyError.actual === 'object' && typeof anyError.expected === 'object') {
				const diff = createDiff(anyError.actual, anyError.expected);
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
}

export interface FormatterProperties {
	filterErrorStack: boolean;
}

export type FormatterOptions = Partial<FormatterProperties>;

export interface FormatOptions {
	space?: string;
}

/**
 * Return a trace line in a standardized format.
 */
function formatLine(data: { func?: string, source: string }, getSource: (name: string) => string) {
	if (!data.func) {
		return '  at <' + getSource(data.source) + '>';
	}
	return '  at ' + data.func + '  <' + getSource(data.source) + '>';
}

/**
 * Parse a stack trace, apply any source mappings, and normalize its format.
 */
function normalizeStackTrace(stack: string, filterStack: boolean, getSource: (name: string) => string) {
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

	let stackLines = /^\s*at /.test(lines[0]) ? processChromeTrace(lines, getSource) : processSafariTrace(lines, getSource);

	if (filterStack) {
		stackLines = stackLines.filter(function (line) {
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
function processChromeTrace(lines: string[], getSource: (name: string) => string) {
	return lines.map(function (line) {
		let match: RegExpMatchArray;
		if ((match = /^\s*at (.+?) \(([^)]+)\)$/.exec(line))) {
			return formatLine({ func: match[1], source: match[2] }, getSource);
		}
		else if ((match = /^\s*at (.*)/.exec(line))) {
			return formatLine({ source: match[1] }, getSource);
		}
		else {
			return line;
		}
	});
}

/**
 * Process Safari and Firefox traces.
 */
function processSafariTrace(lines: string[], getSource: (name: string) => string) {
	return lines.map(function (line) {
		let match: RegExpMatchArray;
		if ((match = /^([^@]+)@(.*)/.exec(line))) {
			return formatLine({ func: match[1], source: match[2] }, getSource);
		}
		else if ((match = /^(\w+:\/\/.*)/.exec(line))) {
			return formatLine({ source: match[1] }, getSource);
		}
		else {
			return line;
		}
	});
}
