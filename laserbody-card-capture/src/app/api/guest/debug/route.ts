import { NextResponse } from "next/server";
import { zenotiFetch } from "@/lib/zenoti";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guest_id = url.searchParams.get("guest_id");
  if (!guest_id) {
    return NextResponse.json({ error: "guest_id is required" }, { status: 400 });
  }

  const guest = await zenotiFetch<any>({
    method: "GET",
    path: `/v1/guests/${guest_id}`,
  });

  // Return ONLY the parts we care about (avoid dumping everything)
  return NextResponse.json({
    id: guest?.id,
    personal_info: guest?.personal_info,
    referral: guest?.referral,
    referral_source_root: guest?.referral_source,
  });
}
