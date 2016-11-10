export * from './selftest.intern';

export const tunnel = 'NullTunnel';

export const environments = [ { browserName: 'chrome' } ];

export const benchmark = true;

export const benchmarkConfig = {
	filename: 'baselines.json',
	verbosity: 2
};

export const benchmarkSuites = [ 'tests/benchmark/all' ];
