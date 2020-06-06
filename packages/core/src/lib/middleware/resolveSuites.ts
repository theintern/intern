import { parse } from 'url';
import { RequestHandler } from 'express';

import { Context } from '../Server';
import { expandFiles } from '../node/util';

export default function resolveSuites(context: Context): RequestHandler {
  return (request, response) => {
    const query = parse(request.url!, true).query;
    const suites = Array.isArray(query.suites)
      ? query.suites!
      : [query.suites!];
    const resolvedSuites = JSON.stringify(expandFiles(suites));
    context.executor.log(
      'resolveSuites middlware expanded',
      suites,
      'to',
      resolvedSuites
    );
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': resolvedSuites.length
    });
    response.end(resolvedSuites);
  };
}
