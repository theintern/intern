/**
 * This module exports an API similar to that of @dojo/core/request that is
 * based on axios.
 */

import axios, {
  AxiosRequestConfig,
  AxiosProxyConfig,
  AxiosResponse
} from 'axios';
import * as qs from 'qs';
import Task, { CancellablePromise } from './Task';
import Evented from './Evented';

export type RequestMethod =
  | 'delete'
  | 'DELETE'
  | 'get'
  | 'GET'
  | 'head'
  | 'HEAD'
  | 'options'
  | 'OPTIONS'
  | 'post'
  | 'POST'
  | 'put'
  | 'PUT';

export interface RequestOptions {
  data?: any;
  followRedirects?: boolean;
  handleAs?: 'text' | 'json';
  headers?: { [key: string]: string | number };
  method?: RequestMethod;
  password?: string;
  query?: string | { [key: string]: any };
  proxy?: string;
  user?: string;
  username?: string;
  onDownloadProgress?: (progressEvent: any) => void;
}

export interface ProgressEvent {
  total: number;
  bytes: number;
  [index: string]: any;
}

export interface Headers {
  all: { [key: string]: string };
  get(key: string): string;
}

export interface Response {
  headers: Headers;
  ok: boolean;
  status: number;
  statusText: string;
  arrayBuffer(): CancellablePromise<ArrayBuffer>;
  json<R = object>(): CancellablePromise<R>;
  text(): CancellablePromise<string>;
}

export default function request(
  url: string,
  options: RequestOptions = {}
): CancellablePromise<Response> {
  const {
    followRedirects,
    handleAs,
    onDownloadProgress,
    password,
    proxy,
    query,
    username,
    ...opts
  } = options;

  const req = <AxiosRequestConfig>{
    method: 'get',
    ...opts,
    url,
    validateStatus: noValidation,
    // Always get response as raw data
    responseType: 'arraybuffer',
    paramsSerializer: serializeParams,
    transformResponse: undefined
  };

  const cancelSource = axios.CancelToken.source();
  req.cancelToken = cancelSource.token;

  if (query) {
    req.params = query;
  }

  if (followRedirects === false) {
    req.maxRedirects = 0;
  }

  if (handleAs) {
    req.responseType = handleAs;
  }

  if (proxy) {
    const proxyUrl = new URL(proxy);
    req.proxy = <AxiosProxyConfig>{
      host: proxyUrl.hostname
    };
    if (proxyUrl.port) {
      req.proxy.port = Number(proxyUrl.port);
    }
    if (proxyUrl.username) {
      req.proxy.auth = {
        username: proxyUrl.username,
        password: proxyUrl.password
      };
    }
  }

  if (username && password) {
    req.auth = { username, password };
  }

  return new Task<Response>(
    (resolve, reject) => {
      axios(req).then(response => {
        if (onDownloadProgress && response && response.data) {
          onDownloadProgress({
            total: response.data.length,
            received: response.data.length
          });
        }
        resolve(new ResponseClass(response));
      }, reject);
    },
    () => {
      cancelSource.cancel();
    }
  );
}

class HeadersClass {
  private data: { [key: string]: string };

  constructor(headers: { [key: string]: string }) {
    this.data = headers;
  }

  get all() {
    const { data } = this;
    return Object.keys(data).reduce(
      (headers: { [key: string]: string }, key) => {
        headers[key.toLowerCase()] = data[key];
        return headers;
      },
      {}
    );
  }

  get(key: string) {
    return String(this.data[key.toLowerCase()]);
  }
}

class ResponseClass<T = any> extends Evented<ProgressEvent>
  implements Response {
  private response: AxiosResponse;
  private headersAccessor: Headers;
  private stringValue: string | PromiseLike<string> | undefined;

  constructor(response: AxiosResponse<T>) {
    super();
    this.response = response;
    this.headersAccessor = new HeadersClass(response.headers);
  }

  /** Header keys will always be lowercase */
  get headers() {
    return this.headersAccessor;
  }

  get ok() {
    const { status } = this.response;
    return status >= 200 && status < 300;
  }

  get status() {
    return this.response.status;
  }

  get statusText() {
    return this.response.statusText;
  }

  arrayBuffer(): CancellablePromise<ArrayBuffer> {
    const { data } = this.response;
    let value: ArrayBuffer | PromiseLike<ArrayBuffer>;

    if (!data) {
      value = new ArrayBuffer(0);
    } else if (typeof data === 'string') {
      value = getArrayBufferFromText(data);
    } else if (isBlob(data)) {
      value = getArrayBufferFromBlob(data);
    } else if (isBuffer(data)) {
      value = data.buffer;
    } else {
      value = data;
    }

    return Task.resolve(value);
  }

  json<R = object>() {
    return this.text().then<R>(JSON.parse);
  }

  text(): CancellablePromise<string> {
    if (typeof this.stringValue === 'undefined') {
      const { data } = this.response;

      if (!data) {
        this.stringValue = '';
      } else if (typeof data === 'string') {
        this.stringValue = data;
      } else if (isArrayBuffer(data)) {
        this.stringValue = getTextFromArrayBuffer(data);
      } else if (isBuffer(data)) {
        this.stringValue = data.toString('utf8');
      } else if (isBlob(data)) {
        this.stringValue = getTextFromBlob(data);
      } else {
        this.stringValue = JSON.stringify(data);
      }
    }

    return Task.resolve(this.stringValue!);
  }
}

function noValidation() {
  return true;
}

function getFileReaderPromise<T extends string | ArrayBuffer>(
  reader: FileReader
): Promise<T> {
  return new Promise((resolve, reject) => {
    reader.onload = function() {
      resolve(<T>reader.result);
    };
    reader.onerror = function() {
      reject(reader.error);
    };
  });
}

function getTextFromBlob(blob: Blob) {
  const reader = new FileReader();
  const promise = getFileReaderPromise<string>(reader);
  reader.readAsText(blob);
  return promise;
}

function getArrayBufferFromBlob(blob: Blob) {
  const reader = new FileReader();
  const promise = getFileReaderPromise<ArrayBuffer>(reader);
  reader.readAsArrayBuffer(blob);
  return promise;
}

function getArrayBufferFromText(text: string) {
  return getArrayBufferFromBlob(new Blob([text], { type: 'text/plain' }));
}

function getTextFromArrayBuffer(buffer: ArrayBuffer) {
  const view = new Uint8Array(buffer);
  const chars: string[] = [];

  view.forEach((charCode, index) => {
    chars[index] = String.fromCharCode(charCode);
  });

  return chars.join('');
}

function isArrayBuffer(value: any): value is ArrayBuffer {
  return (
    value instanceof ArrayBuffer || value.toString() === '[object ArrayBuffer]'
  );
}

function isBlob(value: any): value is Blob {
  return (
    typeof Blob !== 'undefined' &&
    (value instanceof Blob || value.toString() === '[object Blob]')
  );
}

function isBuffer(value: any): value is Buffer {
  return typeof Buffer !== 'undefined' && Buffer.isBuffer(value);
}

function serializeParams(params: { [key: string]: any }) {
  return qs.stringify(params, { arrayFormat: 'repeat' });
}
