import { stat, readFile } from 'fs';
import createError from 'http-errors';
import { lookup } from 'mime-types';
import { join, resolve } from 'path';
import { RequestHandler } from 'express';

import { Context } from '../Server';

export default function instrument(context: Context): RequestHandler {
  const codeCache: {
    [filename: string]: { mtime: number; data: string };
  } = Object.create(null);

  return (request, response, next) => {
    const { basePath, executor } = context;
    const wholePath = resolve(join(basePath, request.url));

    if (
      !(request.method === 'HEAD' || request.method === 'GET') ||
      !executor.shouldInstrumentFile(wholePath)
    ) {
      return next();
    }

    stat(wholePath, (error, stats) => {
      // The server was stopped before this file was served
      if (context.stopped) {
        return;
      }

      if (error || !stats.isFile()) {
        executor.log('Unable to serve', wholePath, '(unreadable)');
        return next(createError(404, error as Error, { expose: false }));
      }

      executor.log('Serving', wholePath);

      const send = (contentType: string, data: string) => {
        response.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(data)
        });
        response.end(request.method === 'HEAD' ? '' : data, callback);
      };
      const callback = (error?: Error) => {
        if (error) {
          executor.emit(
            'error',
            new Error(`Error serving ${wholePath}: ${error.message}`)
          );
        } else {
          executor.log('Served', wholePath);
        }
      };

      const contentType = lookup(wholePath) || 'application/octet-stream';
      const mtime = stats.mtime.getTime();

      if (codeCache[wholePath] && codeCache[wholePath].mtime === mtime) {
        send(contentType, codeCache[wholePath].data);
      } else {
        readFile(wholePath, 'utf8', (error, data) => {
          // The server was stopped in the middle of the file read
          if (context.stopped) {
            return;
          }

          if (error) {
            return next(createError(404, error, { expose: false }));
          }

          // providing `wholePath` to the instrumenter instead of a
          // partial filename is necessary because lcov.info requires
          // full path names as per the lcov spec
          data = executor.instrumentCode(data, wholePath);
          codeCache[wholePath] = {
            // strictly speaking mtime could reflect a previous
            // version, assume those race conditions are rare
            mtime,
            data
          };
          send(contentType, data);
        });
      }
    });
  };
}
