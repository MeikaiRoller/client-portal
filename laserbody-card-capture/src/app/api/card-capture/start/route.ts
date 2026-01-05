import { NextResponse } from "next/server";
import { zenotiFetch } from "@/lib/zenoti";

export const runtime = "nodejs";

type ReqBody = {
  guest_id: string;
  // center_id optional if you still send it from client — we'll ignore and force Brampton
  center_id?: string;
};

type ZenotiAddCardResp = {
  success?: boolean;
  error?: string | null;
  hosted_payment_uri?: string | null;
  token_id?: string | null;
};

export async function POST(req: Request) {
  const reqId = crypto.randomUUID();

  try {
    const body = (await req.json()) as Partial<ReqBody>;

    const guestId = String(body.guest_id ?? "").trim();
    if (!guestId) {
      return NextResponse.json({ error: "Missing guest_id", reqId }, { status: 400 });
    }

    // Force Brampton / default center (server-controlled)
    const DEFAULT_CENTER_ID = (process.env.DEFAULT_CENTER_ID ?? "").trim();
    const centerId = DEFAULT_CENTER_ID || String(body.center_id ?? "").trim();

    if (!centerId) {
      return NextResponse.json(
        { error: "Missing DEFAULT_CENTER_ID (or center_id)", reqId },
        { status: 500 }
      );
    }

    const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").trim();
    const captureId = crypto.randomUUID();
    const redirectUri = new URL(`/card/complete?captureId=${encodeURIComponent(captureId)}`, baseUrl).toString();

    console.log("[card-capture/start] request", { reqId, guest_id: guestId, center_id: centerId, redirectUri });

    const resp = await zenotiFetch<ZenotiAddCardResp>({
      method: "POST",
      path: `/v1/guests/${encodeURIComponent(guestId)}/accounts`,
      body: {
        center_id: centerId,
        redirect_uri: redirectUri,
        source: 1,
      },
    });

    if (resp?.success === false) {
      console.error("[card-capture/start] Zenoti success=false", { reqId, resp });
      return NextResponse.json(
        { error: resp?.error || "Zenoti returned success=false", reqId, zenoti: resp },
        { status: 502 }
      );
    }

    const hosted = resp?.hosted_payment_uri ?? null;
    if (!hosted) {
      console.error("[card-capture/start] Missing hosted_payment_uri", { reqId, resp });
      return NextResponse.json(
        { error: "No hosted_payment_uri returned from Zenoti", reqId, zenoti: resp },
        { status: 502 }
      );
    }

    return NextResponse.json({
      hosted_payment_uri: hosted,
      token_id: resp?.token_id ?? null,
      captureId,
      redirect_uri: redirectUri,
      reqId,
    });
  } catch (err: any) {
    console.error("[card-capture/start] ERROR", { reqId, message: err?.message, stack: err?.stack });
    return NextResponse.json({ error: err?.message ?? "Server error", reqId }, { status: 500 });
  }
}
