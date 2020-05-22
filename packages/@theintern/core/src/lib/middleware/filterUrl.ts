import { RequestHandler } from 'express';

export default function filterUrl(): RequestHandler {
  return (request, _response, next) => {
    request.url = removeLineNumberRequest(request.url);
    next();
  };
}

function removeLineNumberRequest(url: string) {
  // Remove everything from the right of the colon if there are no query parameters
  if (!url || url.indexOf('?') >= 0) {
    return url;
  }
  return url.split(':')[0];
}
