import { parse } from 'url';
import { InternRequestHandler } from '../Server';
import { expandFiles } from '../node/util';

export default function instrument(): InternRequestHandler {
	return (request, response) => {
		console.log('calling resolver');
		const query = parse(request.url!, true).query;
		const suites = Array.isArray(query.suites)
			? query.suites
			: [query.suites];
		const resolvedSuites = JSON.stringify(
			suites.map((pattern: string) => expandFiles(pattern))
		);
		response.writeHead(200, {
			'Content-Type': 'application/json',
			'Content-Length': resolvedSuites.length
		});
		response.end(resolvedSuites);
	};
}
