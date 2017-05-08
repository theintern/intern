declare module 'istanbul-reports' {
	export function create(name: ReportType, options?: any): any;

	export type ReportType =
		'clover' |
		'covertura' |
		'html' |
		'json' |
		'json-summary' |
		'lcov' |
		'lcovonly' |
		'none' |
		'teamcity' |
		'text' |
		'text-lcov' |
		'text-summary';
}
