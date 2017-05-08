import { normalize } from 'path';
import { createInstrumenter, Instrumenter } from 'istanbul-lib-instrument';
import { SourceMapConsumer } from 'source-map';
import { mixin } from '@dojo/core/lang';

let instrumentationSourceMap: { [path: string]: SourceMapConsumer } = {};
let fileSources: { [path: string]: string } = {};
let instrumenters: { [name: string]: Instrumenter } = {};

/**
 * Instrument a given file, saving its coverage source map.
 *
 * @param filedata Text of file being instrumented
 * @param filepath Full path of file being instrumented
 * @param instrumenterOptions Extra options for the instrumenter
 *
 * @returns {string} A string of instrumented code
 */
export default function instrument(filedata: string, filepath: string, instrumenterOptions?: any) {
	const instrumenter = getInstrumenter(instrumenterOptions);
	let options = instrumenter.opts;
	if (!options.codeGenerationOptions) {
		options.codeGenerationOptions = {};
	}

	// Assign to options.codeGenerationOptions to handle the case where codeGenerationOptions is null
	options.codeGenerationOptions = mixin(options.codeGenerationOptions, {
		sourceMap: normalize(filepath),
		sourceMapWithCode: true
	});

	const code = instrumenter.instrumentSync(filedata, normalize(filepath));
	const map = (<any>instrumenter).lastSourceMap();

	if (map) {
		instrumentationSourceMap[filepath] = new SourceMapConsumer(map.toString());
		fileSources[filepath] = filedata;
	}

	return code;
}

/**
 * Return the instrumenter, creating it if necessary.
 */
function getInstrumenter(instrumenterOptions: any) {
	instrumenterOptions = instrumenterOptions || {};

	const coverageVariable = instrumenterOptions.coverageVariable;

	if (!instrumenters[coverageVariable]) {
		const options = mixin({
			// coverage variable is changed primarily to avoid any jshint complaints, but also to make
			// it clearer where the global is coming from
			coverageVariable: coverageVariable,

			// compacting code makes it harder to look at but it does not really matter
			noCompact: true,

			// auto-wrap breaks code
			noAutoWrap: true
		}, instrumenterOptions);

		instrumenters[coverageVariable] = createInstrumenter(options);
	}
	return instrumenters[coverageVariable];
}
