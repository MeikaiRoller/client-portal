export type ZenotiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: any;
  returnMeta?: boolean; // 👈 add this
};

export type ZenotiMeta = {
  status: number;
  url: string;
  rate: Record<string, string>;
};

export class ZenotiError extends Error {
  meta: ZenotiMeta;
  payload: any;

  constructor(message: string, meta: ZenotiMeta, payload: any) {
    super(message);
    this.name = "ZenotiError";
    this.meta = meta;
    this.payload = payload;
  }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickRateHeaders(headers: Headers) {
  const keys = [
    "api-ratelimit-limit",
    "organization-ratelimit-limit",
    "ratelimit-limit",
    "ratelimit-remaining",
    "ratelimit-reset",
    "retry-after",
    "x-request-id",
    "request-id",
    "x-correlation-id",
  ];

  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = headers.get(k);
    if (v) out[k] = v;
  }
  return out;
}

// Overloads so existing calls still work
export async function zenotiFetch<T>(
  opts: ZenotiFetchOptions & { returnMeta: true }
): Promise<{ data: T; meta: ZenotiMeta }>;
export async function zenotiFetch<T>(opts: ZenotiFetchOptions): Promise<T>;

export async function zenotiFetch<T>(opts: ZenotiFetchOptions): Promise<any> {
  const base = process.env.ZENOTI_API_BASE ?? "https://api.zenoti.com";
  const apiKey = process.env.ZENOTI_API_KEY;
  

  if (!apiKey) throw new Error("Missing ZENOTI_API_KEY in environment.");

  const url = new URL(opts.path, base);

  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: `apikey ${apiKey}`,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const json = text ? safeJson(text) : null;

  const meta: ZenotiMeta = {
    status: res.status,
    url: url.toString(),
    rate: pickRateHeaders(res.headers),
  };

  const payload = json ?? (text || null);

  if (!res.ok) {
    const msg =
      (json && (json.message || json.error?.message || json.error)) ||
      text ||
      `Zenoti error ${res.status}`;

    // 👇 This is the key: you now get headers + payload in the thrown error.
    throw new ZenotiError(msg, meta, payload);
  }

  if (opts.returnMeta) {
    return { data: payload as T, meta };
  }

  return payload as T;
}
