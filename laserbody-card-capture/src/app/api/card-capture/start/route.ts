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

  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  const url = new URL(path, base);

  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const method = opts.method ?? "GET";
  const hasBody = opts.body !== undefined && opts.body !== null;

  const headers: Record<string, string> = {
    accept: "application/json",
    Authorization: `apikey ${apiKey}`,
  };

  if (hasBody && method !== "GET") {
    headers["content-type"] = "application/json";
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: hasBody && method !== "GET" ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const json = text ? safeJson(text) : null;

  if (!res.ok) {
    const payload = json ?? text;

    // ✅ THIS is the Zenoti error you’re looking for (prints in your dev terminal)
    console.error("[ZENOTI ERROR]", {
      status: res.status,
      url: url.toString(),
      response: payload,
    });

    const msg =
      (json && (json.message || json.error?.message || json.error)) ||
      text ||
      `Zenoti error ${res.status}`;

    throw new Error(`${res.status} ${msg}`);
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
