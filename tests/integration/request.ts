/// <reference types="intern" />

import { createServer, Server } from 'http';
import request, { Response } from '../../src/lib/request';

const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

registerSuite('integration/request', () => {
  const port = 14493;
  let server!: Server;
  let receivedData: string;

  return {
    before() {
      server = createServer((request, response) => {
        request.setEncoding('utf8');
        request.on('data', (chunk: string) => {
          receivedData += chunk;
        });
        response.end(JSON.stringify({ foo: 'bar' }));
      });
      server.listen(port);
    },

    beforeEach() {
      receivedData = '';
    },

    after() {
      server.close();
    },

    tests: {
      get() {
        let response: Response;
        return request(`http://localhost:${port}`)
          .then(res => {
            response = res;
            assert.equal(response.status, 200);
            return res.text();
          })
          .then(text => {
            assert.equal(text, '{"foo":"bar"}', 'Unxpected text value');
          })
          .then(() => response.json())
          .then(data => {
            assert.deepEqual(data, { foo: 'bar' }, 'Unexpected object value');
          });
      },

      post() {
        return request(`http://localhost:${port}`, {
          method: 'post',
          data: 'testing'
        }).then(response => {
          assert.equal(response.status, 200);
          assert.equal(receivedData, 'testing');
        });
      }
    }
  };
});
