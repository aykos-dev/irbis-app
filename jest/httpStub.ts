import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { axiosInstance } from '../src/shared/api/client';

/**
 * Network test double at the HTTP boundary: replaces the axios adapter of the app's single
 * instance. Each route answers with a status + body, or a network failure; responses honour
 * the request's `validateStatus`, like the real adapter.
 */
type FinalReply = { status: number; body: unknown } | { networkError: true };

/** `hold` delays the reply until the promise settles (e.g. to observe a loading state). */
export type StubReply = FinalReply | { hold: Promise<void>; reply: FinalReply };

type Route = (config: InternalAxiosRequestConfig) => StubReply;

/** A promise plus its resolver, for `hold`. */
export function gate(): { promise: Promise<void>; open: () => void } {
  let open: () => void = () => undefined;
  const promise = new Promise<void>(resolve => {
    open = resolve;
  });
  return { promise, open };
}

export type HttpStub = {
  calls: InternalAxiosRequestConfig[];
  /** Replies are used in order; the last one repeats. */
  reply: (url: string, ...replies: StubReply[]) => void;
  /** Computes the reply from the request (e.g. per query parameter). */
  handle: (url: string, route: (config: InternalAxiosRequestConfig) => StubReply) => void;
  /** Requests made to one url, in order. */
  callsTo: (url: string) => InternalAxiosRequestConfig[];
  restore: () => void;
};

export function stubHttp(): HttpStub {
  const original = axiosInstance.defaults.adapter;
  const routes = new Map<string, Route>();
  const calls: InternalAxiosRequestConfig[] = [];

  const adapter: AxiosAdapter = async config => {
    calls.push(config);
    const route = routes.get(config.url ?? '');
    if (!route) {
      throw new Error(`No stubbed reply for ${config.method} ${config.url}`);
    }
    const planned = route(config);
    let reply: FinalReply;
    if ('hold' in planned) {
      await planned.hold;
      reply = planned.reply;
    } else {
      reply = planned;
    }
    if ('networkError' in reply) {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const response: AxiosResponse = {
      data: reply.body,
      status: reply.status,
      statusText: '',
      headers: {},
      config,
    };
    const accept = config.validateStatus ?? ((status: number) => status >= 200 && status < 300);
    if (accept(reply.status)) {
      return response;
    }
    throw new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, null, response);
  };

  axiosInstance.defaults.adapter = adapter;

  return {
    calls,
    reply(url, ...replies) {
      let index = 0;
      routes.set(url, () => {
        const next = replies[Math.min(index, replies.length - 1)];
        index += 1;
        if (!next) {
          throw new Error(`Empty reply list for ${url}`);
        }
        return next;
      });
    },
    handle(url, route) {
      routes.set(url, route);
    },
    callsTo(url) {
      return calls.filter(call => call.url === url);
    },
    restore() {
      axiosInstance.defaults.adapter = original;
    },
  };
}
