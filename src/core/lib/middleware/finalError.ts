import { ErrorRequestHandler } from 'express';
import { HttpError } from 'http-errors';
import { STATUS_CODES } from 'http';

export default function finalError(): ErrorRequestHandler {
  // Note that the _next parameter is required for this middleware to handle
  // errors. Without it, Express will assume this middleware can't deal with
  // errors and will handle errors itself.
  // See https://expressjs.com/en/guide/using-middleware.html#middleware.error-handling
  return (error: HttpError, request, response, _next) => {
    const message = error.expose
      ? error.message
      : STATUS_CODES[error.statusCode];

    response.writeHead(error.statusCode, {
      'Content-Type': 'text/html;charset=utf-8'
    });

    response.end(`<!DOCTYPE html><title>${
      error.statusCode
    } ${message}</title><h1>${error.statusCode} ${message}: ${request.url}</h1>
<!-- ${new Array(512).join('.')} -->`);
  };
}
