import * as createError from 'http-errors';
import { RequestHandler } from 'express';

export default function unhandled(): RequestHandler {
  return (request, __, next) => {
    if (request.method === 'GET' || request.method === 'HEAD') {
      next(createError(404));
    } else {
      next(createError(501));
    }
  };
}
