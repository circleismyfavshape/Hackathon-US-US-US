import type { LiveEvent } from '../../../contracts/types.ts';

export interface SharedState {
  read(): Promise<string | null>;
  compareAndSet(
    before: string | null,
    after: string,
    event: LiveEvent['type'] | null,
  ): Promise<boolean>;
  subscribe(signal: AbortSignal): Promise<Response>;
}

// Compare and publish in one transaction so concurrent requests cannot overwrite each other.
const COMMIT = `
local current = redis.call('GET', KEYS[1])
if (current or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
if ARGV[3] ~= '' then redis.call('PUBLISH', KEYS[2], ARGV[3]) end
return 1
`;

export class RedisState implements SharedState {
  readonly channel: string;

  constructor(
    private url: string,
    private token: string,
    private key: string,
  ) {
    this.channel = `${key}:events`;
  }

  private async command<T>(args: (string | number)[]): Promise<T> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error('Shared demo storage is unavailable');
    }
    const body = (await response.json()) as { result: T; error?: string };
    if (body.error) {
      throw new Error('Shared demo storage rejected the operation');
    }
    return body.result;
  }

  read() {
    return this.command<string | null>(['GET', this.key]);
  }

  async compareAndSet(before: string | null, after: string, event: LiveEvent['type'] | null) {
    return (
      (await this.command<number>([
        'EVAL',
        COMMIT,
        2,
        this.key,
        this.channel,
        before ?? '',
        after,
        event ? JSON.stringify({ type: event }) : '',
      ])) === 1
    );
  }

  async subscribe(signal: AbortSignal) {
    const response = await fetch(`${this.url}/subscribe/${encodeURIComponent(this.channel)}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, accept: 'text/event-stream' },
      signal,
    });
    if (!response.ok || !response.body) {
      throw new Error('Live updates are unavailable');
    }
    return response;
  }
}

export function hostedState(env: NodeJS.ProcessEnv = process.env) {
  const url = env.KV_REST_API_URL;
  const token = env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('Connect the free Redis integration before deploying');
  }
  // Preview deployments cannot reset or modify the production demonstration.
  const scope =
    env.VERCEL_ENV === 'production'
      ? 'production'
      : `preview:${env.VERCEL_GIT_COMMIT_REF || 'local'}`;
  return new RedisState(url, token, `flare:demo:v1:${scope}`);
}
