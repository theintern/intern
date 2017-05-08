if (intern.environment === 'browser') {
	// This is the least invasive way to get benchmark.js working with SystemJS. The base issue is that when SystemJS
	// loads benchmark.js in AMD mode, benchmark later wants to use the global `define` as an "anchor". The `define`
	// function is only present during module loading when using SystemJS, not at runtime. Instead, we load benchmark as
	// CJS and then define a global Benchmark to use as the anchor.
	(<any>window).Benchmark = {};
}
