import { NextResponse } from "next/server";
import { zenotiFetch } from "@/lib/zenoti";
export const runtime = "nodejs";

const CANADA_COUNTRY_ID = 39; // from your /v1/centers response

function digitsOnly(s?: string) {
  return (s ?? "").replace(/\D/g, "");
}


/**
 * Normalizes North American numbers to 10 digits:
 * - "1XXXXXXXXXX" -> "XXXXXXXXXX"
 * - "XXXXXXXXXX" -> "XXXXXXXXXX"
 * - otherwise returns digits-only as-is (fallback)
 */
function normalizeNorthAmericaPhone(phoneRaw?: string) {
  const d = digitsOnly(phoneRaw);
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return d;
}

function norm(s?: string) {
  return (s ?? "").trim().toLowerCase();
}

type PickResult =
  | { type: "none" }
  | { type: "found"; guest: any }
  | {
      type: "ambiguous";
      candidates: Array<{
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        center_name: string;
      }>;
    };

function getGuestEmail(g: any) {
  return norm(g?.personal_info?.email);
}

function getGuestPhone(g: any) {
  return (
    normalizeNorthAmericaPhone(g?.personal_info?.mobile_phone?.number) ||
    normalizeNorthAmericaPhone(g?.personal_info?.home_phone?.number) ||
    normalizeNorthAmericaPhone(g?.personal_info?.work_phone?.number) ||
    normalizeNorthAmericaPhone(g?.phone)
  );
}

function isExactNameMatch(g: any, fn: string, ln: string) {
  const gfn = norm(g?.personal_info?.first_name);
  const gln = norm(g?.personal_info?.last_name);
  return gfn === fn && gln === ln;
}

function toCandidates(list: any[]) {
  return list.map((g) => ({
    id: g.id,
    first_name: g?.personal_info?.first_name ?? "",
    last_name: g?.personal_info?.last_name ?? "",
    email: g?.personal_info?.email ?? "",
    center_name: g?.center_name ?? g?.center?.display_name ?? g?.center?.name ?? "",
  }));
}

function pickBestGuest(
  guests: any[],
  firstName: string,
  lastName: string,
  phone?: string,
  email?: string
): PickResult {
  if (!Array.isArray(guests) || guests.length === 0) return { type: "none" };

  const fn = norm(firstName);
  const ln = norm(lastName);
  const ph = normalizeNorthAmericaPhone(phone);
  const em = norm(email);

  // 1) Strong identifier matches FIRST (phone/email)
  const strongMatches = guests.filter((g) => {
    const gEmail = getGuestEmail(g);
    const gPhone = getGuestPhone(g);
    const emailMatch = em && gEmail && gEmail === em;
    const phoneMatch = ph && gPhone && gPhone === ph;
    return !!(emailMatch || phoneMatch);
  });

  // If we got exactly one strong match: safe to pick
  if (strongMatches.length === 1) {
    return { type: "found", guest: strongMatches[0] };
  }

  // If multiple guests share phone/email, ONLY auto-pick if name breaks the tie uniquely
  if (strongMatches.length > 1) {
    const exactNameWithinStrong = strongMatches.filter((g) => isExactNameMatch(g, fn, ln));

    if (exactNameWithinStrong.length === 1) {
      return { type: "found", guest: exactNameWithinStrong[0] };
    }

    // Otherwise: ambiguous (return the strong matches, or the exact-name subset if it exists)
    const candidateSource =
      exactNameWithinStrong.length > 0 ? exactNameWithinStrong : strongMatches;

    return { type: "ambiguous", candidates: toCandidates(candidateSource) };
  }

  // 2) If no phone/email matches, fall back to exact full-name match ONLY (conservative)
  const exactNameMatches = guests.filter((g) => isExactNameMatch(g, fn, ln));
  if (exactNameMatches.length === 1) {
    return { type: "found", guest: exactNameMatches[0] };
  }

  // Still not unique => ambiguous (don’t guess on common names)
  return { type: "ambiguous", candidates: toCandidates(exactNameMatches.length ? exactNameMatches : guests) };
}





export async function POST(req: Request) {
  console.log("[lookup-or-create] HIT");
  console.log("[lookup-or-create] HAS KEY?", !!process.env.ZENOTI_API_KEY);

  try {
    const reqId = crypto.randomUUID();
    console.log("[lookup-or-create] reqId", reqId);

    const raw = await req.text();
    console.log("RAW BODY:", raw);
    const body = raw ? JSON.parse(raw) : {};


    const center_id = String(body.center_id ?? "").trim();
    const first_name = String(body.first_name ?? "").trim();
    const last_name = String(body.last_name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phoneRaw = String(body.phone ?? "").trim();
    const phone = normalizeNorthAmericaPhone(phoneRaw);

    if (!center_id) {
      return NextResponse.json({ error: "center_id is required" }, { status: 400 });
    }
    if (!first_name || !last_name) {
      return NextResponse.json({ error: "first_name and last_name are required" }, { status: 400 });
    }
    if (!phone && !email) {
      return NextResponse.json({ error: "phone or email is required" }, { status: 400 });
    }

    // 1) Search org-wide (since your org setting Search Guest Across Centers is enabled)
    // ✅ IMPORTANT: for org-wide search, we OMIT center_id entirely

    const base = { page: 1, size: 50 };

    // 1) Search by strong identifiers FIRST (omit center_id for org-wide)
    console.log("[lookup-or-create] STEP: about to call Zenoti search", {
      reqId,
      email,
      phone,
      first_name,
      last_name,
    });

    let search = await zenotiFetch<any>({
      method: "GET",
      path: "/v1/guests/search",
      query: {
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...base,
      },
    });

    let guests = search?.guests ?? [];

    // 2) If nothing comes back, broaden by adding name
    if (guests.length === 0) {
      search = await zenotiFetch<any>({
        method: "GET",
        path: "/v1/guests/search",
        query: {
          first_name,
          last_name,
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          ...base,
        },
      });

      guests = search?.guests ?? [];
    }

    const result = pickBestGuest(guests, first_name, last_name, phone, email);

    if (result.type === "found") {
      const found = result.guest;

      return NextResponse.json({
        created: false,
        guest: found,
        guest_id: found.id,
      });
    }

    if (result.type === "ambiguous") {
      return NextResponse.json(
        {
          created: false,
          ambiguous: true,
          candidates: result.candidates,
        },
        { status: 409 }
      );
    }

    // 2) Create guest if not found
    const created = await zenotiFetch<any>({
      method: "POST",
      path: "/v1/guests",
      body: {
        center_id, // ✅ required at top level
        personal_info: {
          first_name,
          last_name,
          ...(email ? { email } : {}),
          ...(phone
            ? { mobile_phone: { country_code: CANADA_COUNTRY_ID, number: phone } }
            : {}),
        },
        // Optional, but nice defaults (adjust to your org’s policy)
        preferences: {
          receive_transactional_email: true,
          receive_transactional_sms: true,
          receive_marketing_email: false,
          receive_marketing_sms: false,
        },
      },
    });

    return NextResponse.json({
      created: true,
      guest: created,
      guest_id: created?.id,
    });
  } catch (e: any) {
    console.error("[lookup-or-create] ERROR", {
      message: e?.message,
      stack: e?.stack,
    });

    return NextResponse.json(
      {
        error: e?.message ?? "lookup-or-create failed",
        stack: process.env.NODE_ENV === "development" ? e?.stack : undefined,
      },
      { status: 500 }
    );
  }

}
