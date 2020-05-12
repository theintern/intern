// import { SinonSpy } from 'sinon';
import { Config } from 'src/core/lib/executors/Executor';

// const { assert } = intern.getPlugin('chai');

export function createConfig(config?: Partial<Config>) {
  const cfg: Config = {
    basePath: '',
    bail: false,
    baseline: false,
    benchmark: false,
    browser: {},
    capabilities: {},
    connectTimeout: 30000,
    coverage: [],
    coverageVariable: '__coverage__',
    debug: Boolean(config?.debug) || false,
    defaultTimeout: 30000,
    description: '',
    environments: [{ browserName: 'node' }],
    filterErrorStack: false,
    functionalCoverage: false,
    functionalRetries: 0,
    functionalSuites: [],
    functionalTimeouts: {},
    grep: new RegExp(''),
    heartbeatInterval: 60,
    instrumenterOptions: {},
    internPath: '',
    leaveRemoteOpen: false,
    loader: { script: 'default' },
    maxConcurrency: Infinity,
    name: 'intern',
    node: {},
    plugins: [],
    remoteOptions: {},
    reporters: [],
    runInSync: false,
    serveOnly: false,
    serverPort: 9000,
    serverUrl: '',
    socketPort: 9001,
    sessionId: '',
    suites: <string[]>[],
    tunnel: 'selenium',
    tunnelOptions: { tunnelId: String(Date.now()) },
    warnOnUncaughtException: false,
    warnOnUnhandledRejection: false,
    ...config
  };

  return cfg;
}
