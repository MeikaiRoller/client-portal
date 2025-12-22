type ZenotiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

export async function zenotiFetch<T>(opts: ZenotiFetchOptions): Promise<T> {
  const base = process.env.ZENOTI_API_BASE ?? "https://api.zenoti.com";
  const apiKey = process.env.ZENOTI_API_KEY;

  if (!apiKey) throw new Error("Missing ZENOTI_API_KEY in environment.");

  const url = new URL(opts.path, base);

  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined) continue;
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
    // Next server runtime: no caching for safety
    cache: "no-store",
  });

  const text = await res.text();
  const json = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg =
      (json && (json.message || json.error?.message || json.error)) ||
      text ||
      `Zenoti error ${res.status}`;
    throw new Error(msg);
  }

  return json as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
