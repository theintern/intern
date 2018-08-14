/**
 * This module exports an API similar to that of @dojo/core/request that is
 * based on axios.
 */

import axios, {
  AxiosRequestConfig,
  AxiosProxyConfig,
  AxiosResponse
} from 'axios';
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

  if (!req.responseType) {
    // Always get response as raw data
    req.responseType = 'arraybuffer';
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
  private data: any;

  constructor(headers: any) {
    this.data = headers;
  }

  get(key: string) {
    return String(this.data[key.toLowerCase()]);
  }
}

class ResponseClass<T = any> extends Evented<ProgressEvent>
  implements Response {
  private response: AxiosResponse;
  private headersAccessor: Headers;

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
    return Task.resolve<ArrayBuffer>(data ? data : new ArrayBuffer(0));
  }

  json<R = object>() {
    return this.text().then<R>(JSON.parse);
  }

  text(): CancellablePromise<string> {
    const { data } = this.response;
    return Task.resolve<string>(data ? data.toString('utf8') : '');
  }
}

function noValidation() {
  return true;
}
