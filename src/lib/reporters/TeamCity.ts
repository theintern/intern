import { Reporter, ReporterConfig, ReporterOutput } from '../../interfaces';
import * as util from '../util';
import { Test } from '../Test';
import { Suite } from '../Suite';

/**
 * This reporter enables Intern to interact with TeamCity.
 * http://confluence.jetbrains.com/display/TCD8/Build+Script+Interaction+with+TeamCity
 *
 * Portions of this module are based on functions from teamcity-service-messages:
 * https://github.com/pifantastic/teamcity-service-messages.
 */
export class TeamCity implements Reporter {
	output: ReporterOutput;

	constructor(config: ReporterConfig = {}) {
		this.output = config.output;
	}

	/**
	 * Escape a string for TeamCity output.
	 *
	 * @param  {string} string
	 * @return {string}
	 *
	 * Based on Message.prototype.escape from teamcity-service-messages
	 */
	/* private */ _escapeString(str: string): string {
		const replacer = /['\n\r\|\[\]\u0100-\uffff]/g;
		const map = {
			'\'': '|\'',
			'|': '||',
			'\n': '|n',
			'\r': '|r',
			'[': '|[',
			']': '|]'
		};

		return str.replace(replacer, function (character: string): string {
			if (character in map) {
				return (<{ [key: string]: any }> map)[character];
			}
			if (/[^\u0000-\u00ff]/.test(character)) {
				return '|0x' + character.charCodeAt(0).toString(16);
			}
			return '';
		});
	}

	/**
	 * Output a TeamCity message.
	 *
	 * @param  {string} type
	 * @param  {Object}  args
	 *
	 * Based on Message.prototype.formatArgs from teamcity-service-messages
	 */
	private _sendMessage(type: string, args: any): void {
		args.timestamp = new Date().toISOString().slice(0, -1);
		args = Object.keys(args).map(key => `${key}='${this._escapeString(String(args[key]))}'`).join(' ');

		this.output.write(`##teamcity[${type} ${args}]\n`);
	}

	testStart(test: Test) {
		this._sendMessage('testStarted', { name: test.id, flowId: test.sessionId });
	}

	testSkip(test: Test) {
		this._sendMessage('testIgnored', { name: test.id, flowId: test.sessionId });
	}

	testEnd(test: Test) {
		this._sendMessage('testFinished', {
			name: test.id,
			duration: test.timeElapsed,
			flowId: test.sessionId
		});
	}

	testFail(test: Test) {
		const message: any = {
			name: test.id,
			message: util.getErrorMessage(test.error),
			flowId: test.sessionId
		};

		if (test.error.actual && test.error.expected) {
			message.type = 'comparisonFailure';
			message.expected = test.error.expected;
			message.actual = test.error.actual;
		}

		this._sendMessage('testFailed', message);
	}

	suiteStart(suite: Suite) {
		if (!suite.parent) {
			return;
		}

		this._sendMessage('testSuiteStarted', {
			name: suite.id,
			startDate: new Date(),
			flowId: suite.sessionId
		});
	}

	suiteEnd(suite: Suite) {
		if (!suite.parent) {
			return;
		}

		this._sendMessage('testSuiteFinished', {
			name: suite.id,
			duration: suite.timeElapsed,
			flowId: suite.sessionId
		});
	}

	suiteError(suite: Suite) {
		this._sendMessage('message', {
			name: suite.id,
			flowId: suite.sessionId,
			text: 'SUITE ERROR',
			errorDetails: util.getErrorMessage(suite.error),
			status: 'ERROR'
		});
	}
}
