/* jshint node:true */
import * as intern from '../../main';
import * as util from '../util';
import * as fs from 'dojo/node!fs';
import { Suite } from '../Suite';
import { Test } from '../Test';
import { Reporter, ReporterConfig, ReporterOutput, Remote } from '../../interfaces';
import Collector = require('dojo/node!istanbul/lib/collector');
import JsonReporter = require('dojo/node!istanbul/lib/report/json');
import LcovHtmlReporter = require('dojo/node!istanbul/lib/report/html');
import TextReporter = require('dojo/node!istanbul/lib/report/text');
import Report = require('dojo/node!istanbul/lib/report');
import * as Tunnel from 'digdug/Tunnel';

class Combined implements Reporter {
	private _collector: Collector;
	private _hasDot: boolean;
	private _reporters: Report[];
	output: ReporterOutput;

	constructor(config: ReporterConfig = {}) {
		this._collector = new Collector();
		this.output = config.output;
		this._hasDot = false;

		if (intern.mode === 'client') {
			this._reporters = [
				new JsonReporter()
			];
		}
		else {
			this._reporters = [
				new TextReporter({ watermarks: config.watermarks }),
				new LcovHtmlReporter({ dir: config.directory, watermarks: config.watermarks })
			];
		}
	}

	private _writeLine() {
		if (this._hasDot) {
			this.output.write('\n');
			this._hasDot = false;
		}
	}

	coverage(sessionId: string, coverage: Object): void {
		this._collector.add(coverage);
	}

	deprecated(deprecated: string, replacement: string, extra: string): void {
		this.output.write(`⚠  ${deprecated}  is deprecated.`);
		if (replacement) {
			this.output.write(` Use ${replacement} instead.`);
		}
		if (extra) {
			this.output.write(extra);
		}
		this.output.write('\n');
	}

	fatalError(error: Error): void {
		this._writeLine();
		this.output.write(util.getErrorMessage(error) + '\n');
	}

	run(): void {
		this.output.write(`Running ${intern.mode} tests...\n`);
	}

	runEnd(): void {
		const collector = this._collector;

		if (intern.mode === 'runner' && fs.existsSync('coverage-final.json')) {
			collector.add(JSON.parse(fs.readFileSync('coverage-final.json').toString()));
		}

		this._writeLine();
		this._reporters.forEach(function (reporter) {
			reporter.writeReport(collector, true);
		});
	}

	sessionStart(remote: Remote) {
		this._writeLine();
		this.output.write(`Testing ${remote.environmentType}\n`);
	}

	suiteError(suite: Suite, error: Error): void {
		this._writeLine();
		this.output.write(util.getErrorMessage(error) + '\n');
	}

	tunnelDownloadProgress(tunnel: Tunnel, progress: { loaded: number, total: number }): void {
		const total = progress.loaded / progress.total;

		if (isNaN(total)) {
			return;
		}

		this.output.write('\rDownload ' + (total * 100).toFixed(2) + '% complete');

		if (total === 1) {
			this.output.write('\n');
		}
	}

	tunnelStart(): void {
		this._writeLine();
		this.output.write('\r\x1b[KTunnel started\n');
	}

	tunnelStatus(tunnel: Tunnel, status: string): void {
		this.output.write(`\r\x1b[KTunnel:${status}`);
	}

	testFail(test: Test): void {
		this._writeLine();
		this.output.write(`FAIL: ${test.id}\n`);
		this.output.write(util.getErrorMessage(test.error) + '\n');
	}

	testPass(): void {
		if (intern.mode === 'runner') {
			this.output.write('.');
			this._hasDot = true;
		}
	}

}
