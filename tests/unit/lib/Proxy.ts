import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import {IRequire } from 'dojo/loader';
import { Proxy } from '../../../src/lib/Proxy';
import Promise = require('dojo/Promise');
import * as fs from 'dojo/node!fs';
import * as querystring from 'dojo/node!querystring';

declare const require: IRequire;

function createRequest(url?: string): { method: string, url: string } {
	return {
		method: 'GET',
		url: url
	};
}

function createResponse(done?: Function) {
	return {
		data: '',
		end(this: any, data?: string) {
			if (data) {
				this.data += data;
			}
			done && done.call(this);
		},
		write(this: any, data?: string) {
			this.data += data;
			return true;
		},
		writeHead(this: any, head: Object) {
			this.headers = head;
		},

		// WritableStream interface methods
		on() {},
		once() {},
		emit() {},

		// EventEmitter interface methods
		prependListener: function () {}
	};
}

registerSuite({
	name: 'lib/Proxy',

	_handle: {
		'correct handler called'() {
			const proxy = new Proxy({ instrument: false });
			proxy._resolveSuites = function () {
				calls.push('resolveSuites');
			};
			proxy._handleFile = function () {
				calls.push('handleFile');
			};
			const request = createRequest();
			const response = createResponse();
			const query = querystring.stringify({ suites: [ 'intern-selftest/tests/unit/*' ] });

			let calls: any[] = [];
			request.url = '/__intern/__resolveSuites__?' + query;
			proxy._handler(<any> request, <any> response);
			assert.deepEqual(calls, [ 'resolveSuites' ], '__resolveSuites__ request sent to unexpected handler');

			calls = [];
			request.url = '/__intern/package/module.js';
			proxy._handler(<any> request, <any> response);
			assert.deepEqual(calls, [ 'handleFile' ], 'File request sent to unexpected handler');

			calls = [];
			request.url = '/__intern/package/module';
			proxy._handler(<any> request, <any> response);
			assert.deepEqual(calls, [ 'handleFile' ], 'Module ID request sent to unexpected handler');
		}
	},

	_handleFile() {
		const proxy = new Proxy({
			excludeInstrumentation: true,
			// Use empty basePath for path resolution
			basePath: '/'
		});
		// A value for the proxy.server is required for _handleFile to actually handle a file
		proxy.server = <any> true;

		const dfd = new Promise.Deferred();
		const url = require.toUrl('../../../src/lib/util.js');
		const expected = fs.readFileSync(url, { encoding: 'utf8' });
		const request = createRequest();

		const response = createResponse(function (this: any) {
			dfd.resolve(this.data);
		});

		request.url = url;
		proxy._handleFile(<any> request, <any> response);

		return dfd.promise.then(function (data) {
			assert.equal(data, expected);
		});
	},

	_resolveSuites: {
		'invalid package'() {
			const proxy = new Proxy();
			const query = querystring.stringify({ suites: JSON.stringify([ 'intern-selftests/tests/unit/*' ]) });
			const request = createRequest('/__intern/__resolveSuites__?' + query);
			const response = createResponse();

			proxy._resolveSuites(<any> request, <any> response);

			// Ensure returned value is JSON
			let resolvedSuites: any;
			assert.doesNotThrow(function () {
				resolvedSuites = JSON.parse(response.data);
			}, 'Returned data should have been a serialized JSON value');

			// If an invalid suite or glob is provided, an empty list should be returned
			assert.lengthOf(resolvedSuites, 0, 'Expected resolved suites list to be empty');
		},

		'valid package'() {
			const proxy = new Proxy();
			const query = querystring.stringify({ suites: JSON.stringify([
				'intern-selftest/dist/tests/unit/*',
				'intern-selftest/dist/tests/functional/**/*'
			]) });
			const request = createRequest('/__intern/__resolveSuites__?' + query);
			const expected = [
				'intern-selftest/dist/tests/unit/all',
				'intern-selftest/dist/tests/unit/main',
				'intern-selftest/dist/tests/unit/order',
				'intern-selftest/dist/tests/functional/lib/ProxiedSession'
			];
			const response = createResponse();

			proxy._resolveSuites(<any> request, <any> response);

			// Ensure returned value is JSON
			let resolvedSuites: any;
			assert.doesNotThrow(function () {
				resolvedSuites = JSON.parse(response.data);
			}, 'Returned data should have been a serialized JSON value');

			assert.deepEqual(resolvedSuites, expected);
		}
	}
});
