import { InternRequestHandler } from '../Server';
import * as createError from 'http-errors';

export default function unhandled(): InternRequestHandler {
	return (_, __, next) => next(createError(501));
}
