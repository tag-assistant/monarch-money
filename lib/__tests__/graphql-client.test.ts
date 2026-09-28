import { GraphQLClient } from '../client/graphql/GraphQLClient';
import { MonarchAPIError, MonarchNetworkError } from '../utils';

function fakeAuth() {
  return {
    ensureValidSession: jest.fn(async () => undefined),
    getToken: jest.fn(() => 'test-token'),
    getDeviceUuid: jest.fn(() => 'device'),
    deleteSession: jest.fn(),
  } as any;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function fakeClock() {
  let t = 1_000_000;
  const waits: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => { waits.push(ms); t += ms; },
    waits,
  };
}

describe('GraphQLClient rate limiting', () => {
  test('does not stall for 60s after a handful of requests', async () => {
    const clock = fakeClock();
    const fetchImpl = jest.fn(async () => jsonResponse({ data: { ok: true } }));
    const client = new GraphQLClient('https://x', fakeAuth(), undefined, 1000, {
      fetchImpl: fetchImpl as any, now: clock.now, sleep: clock.sleep,
    });
    for (let i = 0; i < 20; i++) {
      await client.query(`query Q${i} { ok }`, undefined, { cache: false });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(20);
    expect(Math.max(0, ...clock.waits)).toBeLessThanOrEqual(250);
  });

  test('honors requestsPerMinute from config, including concurrent callers', async () => {
    const clock = fakeClock();
    const fetchImpl = jest.fn(async () => jsonResponse({ data: { ok: true } }));
    const client = new GraphQLClient('https://x', fakeAuth(), undefined, 1000, {
      fetchImpl: fetchImpl as any, now: clock.now, sleep: clock.sleep,
      rateLimit: { requestsPerMinute: 3, burstLimit: 3 }, minRequestIntervalMs: 0,
    });
    await Promise.all([0, 1, 2, 3].map(i => client.query(`query C${i} { ok }`, undefined, { cache: false })));
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    // The 4th request must wait for the 60s window to roll over.
    expect(clock.waits.some(w => w > 59_000)).toBe(true);
  });
});

describe('GraphQLClient keys', () => {
  test('different unnamed queries do not share results', async () => {
    const fetchImpl = jest.fn(async (_url: any, init: any) => {
      const q = JSON.parse(init.body).query as string;
      return jsonResponse({ data: { which: q.includes('me') ? 'me' : 'accounts' } });
    });
    const client = new GraphQLClient('https://x', fakeAuth(), undefined, 1000, {
      fetchImpl: fetchImpl as any, sleep: async () => undefined,
    });
    const [a, b] = await Promise.all([
      client.query<any>('{ me { id } }'),
      client.query<any>('{ accounts { id } }'),
    ]);
    expect(a.which).toBe('me');
    expect(b.which).toBe('accounts');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('GraphQLClient timeouts and retries', () => {
  test('aborts a hung request after the timeout', async () => {
    const fetchImpl = jest.fn((_url: any, init: any) => new Promise<Response>((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    }));
    const client = new GraphQLClient('https://x', fakeAuth(), undefined, 50, {
      fetchImpl: fetchImpl as any, retries: 0,
    });
    await expect(client.query('query Hang { ok }', undefined, { cache: false }))
      .rejects.toBeInstanceOf(MonarchNetworkError);
  });

  test('retries queries on network errors', async () => {
    let calls = 0;
    const fetchImpl = jest.fn(async () => {
      if (calls++ === 0) throw new TypeError('fetch failed');
      return jsonResponse({ data: { ok: true } });
    });
    const client = new GraphQLClient('https://x', fakeAuth(), undefined, 1000, {
      fetchImpl: fetchImpl as any, retryDelay: 0, minRequestIntervalMs: 0,
    });
    await expect(client.query('query R { ok }', undefined, { cache: false })).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('does not replay mutations after a network error', async () => {
    const fetchImpl = jest.fn(async () => { throw new TypeError('fetch failed'); });
    const client = new GraphQLClient('https://x', fakeAuth(), undefined, 1000, {
      fetchImpl: fetchImpl as any, retryDelay: 0,
    });
    await expect(client.mutation('mutation M { ok }')).rejects.toBeInstanceOf(MonarchAPIError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('GraphQLClient session handling', () => {
  test('a GraphQL error mentioning "token" does not delete the session', async () => {
    const auth = fakeAuth();
    const fetchImpl = jest.fn(async () => jsonResponse({ errors: [{ message: 'Invalid token filter value' }] }));
    const client = new GraphQLClient('https://x', auth, undefined, 1000, { fetchImpl: fetchImpl as any, retries: 0 });
    await expect(client.query('query T { ok }', undefined, { cache: false })).rejects.toThrow('Invalid token filter value');
    expect(auth.deleteSession).not.toHaveBeenCalled();
  });

  test('a structured UNAUTHENTICATED error deletes the session', async () => {
    const auth = fakeAuth();
    const fetchImpl = jest.fn(async () => jsonResponse({ errors: [{ message: 'nope', extensions: { code: 'UNAUTHENTICATED' } }] }));
    const client = new GraphQLClient('https://x', auth, undefined, 1000, { fetchImpl: fetchImpl as any, retries: 0 });
    await expect(client.query('query T { ok }', undefined, { cache: false })).rejects.toThrow();
    expect(auth.deleteSession).toHaveBeenCalled();
  });

  test('HTTP 401 deletes the session', async () => {
    const auth = fakeAuth();
    const fetchImpl = jest.fn(async () => jsonResponse({}, 401));
    const client = new GraphQLClient('https://x', auth, undefined, 1000, { fetchImpl: fetchImpl as any, retries: 0 });
    await expect(client.query('query T { ok }', undefined, { cache: false })).rejects.toThrow();
    expect(auth.deleteSession).toHaveBeenCalled();
  });
});
