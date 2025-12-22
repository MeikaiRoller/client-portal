import { NextResponse } from "next/server";
import { zenotiFetch } from "@/lib/zenoti";

type ReqBody = {
  center_id: string;
  guest_id: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;

    if (!body.center_id) return NextResponse.json({ error: "Missing center_id" }, { status: 400 });
    if (!body.guest_id) return NextResponse.json({ error: "Missing guest_id" }, { status: 400 });

    const redirectUri = new URL("/card/complete", process.env.APP_BASE_URL ?? "http://localhost:3000").toString();

    // NOTE: Replace path/body with the exact Zenoti doc for your "Add card for guest" endpoint.
    // Your note says Zenoti returns a hosted payment URI (good).
    const resp = await zenotiFetch<any>({
      method: "POST",
      path: `/v1/guests/${body.guest_id}/payment-methods`, // <-- very likely different; we will adjust to your doc
      body: {
        center_id: body.center_id,
        redirect_uri: redirectUri,
        source: 1,
      },
    });

    const hostedUrl =
      resp?.hosted_payment_uri ??
      resp?.payment_uri ??
      resp?.url ??
      resp?.hosted_url ??
      null;

    if (!hostedUrl) {
      return NextResponse.json(
        { error: "No hosted payment URI returned (endpoint/path may not match Zenoti doc)." },
        { status: 500 }
      );
    }

    return NextResponse.json({ hosted_url: hostedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
