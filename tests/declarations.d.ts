declare module 'dojo/node!istanbul/lib/collector' {
	import collector = require('istanbul/lib/collector');
	export = collector;
}
declare module 'dojo/node!istanbul/lib/report/json' {
	import json = require('istanbul/lib/report/json');
	export = json;
}
declare module 'dojo/node!istanbul/lib/report/html' {
	import html = require('istanbul/lib/report/html');
	export = html;
}
declare module 'dojo/node!istanbul/lib/report/text' {
	import text = require('istanbul/lib/report/text');
	export = text;
}
declare module 'dojo/node!fs' {
	export * from 'fs';
}
declare module 'dojo/node!path' {
	export * from 'path';
}
declare module 'dojo/node!url' {
	export * from 'url';
}
declare module 'dojo/node!jszip' {
	import JSZip = require('jszip');
	export = JSZip;
}
