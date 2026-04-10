import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { zenotiFetch } from "@/lib/zenoti";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const guest_id = searchParams.get("guest_id")?.trim();
  const center_id = searchParams.get("center_id")?.trim();
  const page_num = Number(searchParams.get("page_num") ?? "1");
  const page_size = Number(searchParams.get("page_size") ?? "50");
  const show_redeemable = searchParams.get("show_redeemable") !== "false";

  if (!guest_id || !center_id) {
    return NextResponse.json({ error: "guest_id and center_id are required" }, { status: 400 });
  }

  try {
    const data = await zenotiFetch<unknown>({
      path: `/v1/guests/${encodeURIComponent(guest_id)}/Packages`,
      query: {
        center_id,
        show_redeemable,
        page_num,
        page_size,
      },
    });

    return NextResponse.json(data);
  } catch (error: any) {
    const status = error?.meta?.status ?? 500;
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch packages" },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
