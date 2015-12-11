// TODO: Send mode *to* reporter, instead of putting it on a global object and retrieving it indirectly.
import { mode } from '../../main';
import { getErrorMessage } from '../util';
import fs = require('fs');
import Collector = require('istanbul/lib/collector');
import JsonReporter = require('istanbul/lib/report/json');
import LcovHtmlReporter = require('istanbul/lib/report/html');
import { CoverageMap } from 'istanbul/lib/instrumenter';
import TextReporter = require('istanbul/lib/report/text');
import IstanbulReporter = require('istanbul/lib/report/index');
import { Reporter, ReporterKwArgs, OutputStream } from '../ReporterManager';
import Suite from '../Suite';
import Test from '../Test';
import Tunnel = require('digdug/Tunnel');
import { Command } from '../ProxiedSession';

// TODO: Is this really necessary?
import 'istanbul/index';

export interface KwArgs extends ReporterKwArgs {
	directory?: string;
}

export default class Combined implements Reporter {
	private _collector: Collector;
	private _hasDot: boolean;
	private output: OutputStream;
	private _reporters: IstanbulReporter[];

	constructor(config: KwArgs = {}) {
		this._collector = new Collector();
		this._hasDot = false;
		this.output = config.output;

		if (mode === 'client') {
			this._reporters = [
				new JsonReporter()
			];
		}
		else {
			this._reporters = [
				new TextReporter({
					watermarks: config.watermarks
				}),
				new LcovHtmlReporter({
					dir: config.directory,
					watermarks: config.watermarks
				})
			];
		}
	}

	coverage(sessionId: string, coverage: CoverageMap) {
		this._collector.add(coverage);
	}

	deprecated(deprecated: string, replacement: string, extra: string) {
		this.output.write('⚠ ' + deprecated + ' is deprecated.');
		if (replacement) {
			this.output.write(' Use ' + replacement + ' instead.');
		}
		if (extra) {
			this.output.write(extra);
		}
		this.output.write('\n');
	}

	fatalError(error: Error) {
		this._writeLine();
		this.output.write(getErrorMessage(error) + '\n');
	}

	run() {
		this.output.write('Running ' + mode + ' tests…\n');
	}

	runEnd() {
		const collector = this._collector;

		if (mode === 'runner' && fs.existsSync('coverage-final.json')) {
			collector.add(JSON.parse(fs.readFileSync('coverage-final.json', 'utf8')));
		}

		this._writeLine();
		this._reporters.forEach(function (reporter) {
			reporter.writeReport(collector, true);
		});
	}

	sessionStart(remote: Command<void>) {
		this._writeLine();
		this.output.write('Testing ' + remote.environmentType + '\n');
	}

	suiteError(suite: Suite, error: Error) {
		this._writeLine();
		this.output.write(getErrorMessage(error) + '\n');
	}

	tunnelDownloadProgress(tunnel: Tunnel, progress: Tunnel.Progress) {
		const total = progress.loaded / progress.total;

		if (isNaN(total)) {
			return;
		}

		this.output.write('\rDownload ' + (total * 100).toFixed(2) + '% complete');

		if (total === 1) {
			this.output.write('\n');
		}
	}

	tunnelStart() {
		this._writeLine();
		this.output.write('\r\x1b[KTunnel started\n');
	}

	tunnelStatus(tunnel: Tunnel, status: string) {
		this.output.write('\r\x1b[KTunnel: ' + status);
	}

	testFail(test: Test) {
		this._writeLine();
		this.output.write('FAIL: ' + test.id + '\n');
		this.output.write(getErrorMessage(test.error) + '\n');
	}

	testPass() {
		if (mode === 'runner') {
			this.output.write('.');
			this._hasDot = true;
		}
	}

	private _writeLine() {
		if (this._hasDot) {
			this.output.write('\n');
			this._hasDot = false;
		}
	}
}
