import * as createError from 'http-errors';
import { InternRequestHandler } from '../Server';

export default function unhandled(): InternRequestHandler {
	return (_, __, next) => next(createError(501));
}
