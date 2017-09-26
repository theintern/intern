import * as createError from 'http-errors';
import { InternRequestHandler } from '../Server';

export default function unhandled(): InternRequestHandler {
	return (request, __, next) => {
		if (request.method === 'GET' || request.method === 'HEAD') {
			next(createError(404));
		} else {
			next(createError(501));
		}
	};
}
