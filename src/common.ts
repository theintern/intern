import 'chai';
import * as Tunnel from 'digdug/Tunnel';
import Executor from './lib/executors/Executor';
import { ReporterDescriptor } from './lib/ReporterManager';
import EnvironmentType from './lib/EnvironmentType';
import { IConfig } from 'dojo/loader';
import Test from './lib/Test';
import Suite from './lib/Suite';
import Command = require('leadfoot/Command');
import Promise = require('dojo/Promise');

export interface Config {
	bail?: boolean;
	basePath?: string;
	benchmark?: boolean;
	benchmarkConfig?: ReporterDescriptor;
	capabilities?: {
		name?: string,
		build?: string,
		[key: string]: any
	};
	config?: string;
	coverageVariable?: string;
	defaultTimeout?: number;
	environments?: { [key: string]: any }[];
	environmentRetries?: number;
	excludeInstrumentation?: boolean|RegExp;
	filterErrorStack?: boolean;
	functionalSuites?: string[];
	grep?: RegExp;
	instrumenterOptions?: any;
	leaveRemoteOpen?: 'fail'|boolean;
	loader?: any;
	loaderOptions?: IConfig;
	loaders?: {
		'host-browser'?: string;
		'host-node'?: string;
	};
	maxConcurrency?: number;
	proxyOnly?: boolean;
	proxyPort?: number;
	proxyUrl?: string;
	reporters?: (string|ReporterDescriptor)[];
	runnerClientReporter?: {
		waitForRunner?: boolean
	};
	rootSuiteName?: string;
	sessionId?: string;
	setup?: (executor: Executor) => Promise<any>;
	suites?: string[];
	teardown?: (executor: Executor) => Promise<any>;
	tunnel?: string;
	tunnelOptions?: {
		servers?: string[],
		[key: string]: any
	};
	useLoader?: {
		'host-browser'?: string;
		'host-node'?: string;
	};
}

export interface Deferred<T> extends Promise.Deferred<T> {
	callback(callback: (...args: any[]) => any): any;
	rejectOnError(callback: (...args: any[]) => any): any;
}

export interface CommandLineArguments {
	config?: string;
	excludeInstrumentation?: boolean|string|RegExp;
	loaders?: { [key: string]: string };
	[key: string]: any;
}

export interface InternError {
	name: string;
	message: string;
	stack?: string;
	showDiff?: boolean;
	actual?: string;
	expected?: string;
	relatedTest?: Test;
}

export interface Remote extends Command<any> {
	environmentType?: EnvironmentType;
	setHeartbeatInterval(delay: number): Command<any>;
}

export interface Removable {
	remove: () => void;
}

export interface ProxyConfig {
	basePath?: string;
	excludeInstrumentation?: boolean|RegExp;
	instrument?: boolean;
	instrumenterOptions?: any;
	port?: number;
	waitForRunner?: boolean;
}

export interface Proxy {
	config: ProxyConfig;
	server: Object; // http.Server; start(): Promise<void>; }
}

export interface ReporterOutput {
	write(chunk: string | Buffer, encoding?: string, callback?: Function): void;
	end(chunk: string | Buffer, encoding?: string, callback?: Function): void;
}

export interface ReporterConfig {
	console?: any; // Console
	watermarks?: any; // Watermarks;
	filename?: string;
	output?: ReporterOutput;
	projectRoot?: string;
	directory?: string;
}

export interface Reporter {
	console?: any;
	destroy?: () => void;
	coverage?: (sessionId: string, data?: Object) => Promise<any> | void;
	deprecated?: (name: string, replacement?: string, extra?: string) => Promise<any> | void;
	fatalError?: (error: Error) => Promise<any> | void;
	newSuite?: (suite: Suite) => Promise<any> | void;
	newTest?: (test: Test) => Promise<any> | void;
	proxyEnd?: (config: Proxy) => Promise<any> | void;
	proxyStart?: (config: Proxy) => Promise<any> | void;
	reporterError?: (reporter: Reporter, error: Error) => Promise<any> | void;
	runEnd?: (executor: Executor) => Promise<any> | void;
	runStart?: (executor: Executor) => Promise<any> | void;
	suiteEnd?: (suite: Suite) => Promise<any> | void;
	suiteError?: (suite: Suite, error: Error) => Promise<any> | void;
	suiteStart?: (suite: Suite) => Promise<any> | void;
	testEnd?: (test: Test) => Promise<any> | void;
	testFail?: (test: Test) => Promise<any> | void;
	testPass?: (test: Test) => Promise<any> | void;
	testSkip?: (test: Test) => Promise<any> | void;
	testStart?: (test: Test) => Promise<any> | void;
	tunnelDownloadProgress?: (tunnel: Tunnel, progress: { loaded: number, total: number }) => Promise<any> | void;
	tunnelEnd?: (tunnel: Tunnel) => Promise<any> | void;
	tunnelStart?: (tunnel: Tunnel) => Promise<any> | void;
	tunnelStatus?: (tunnel: Tunnel, status: string) => Promise<any> | void;
	$others?: (...args: any[]) => Promise<any> | void;
}
