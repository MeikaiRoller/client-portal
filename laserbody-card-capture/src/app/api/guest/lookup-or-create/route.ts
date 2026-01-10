import { NextResponse } from "next/server";
import { zenotiFetch } from "@/lib/zenoti";
import { CENTERS } from "@/lib/centers";
import { date } from "zod";

export const runtime = "nodejs";

const CANADA_COUNTRY_ID = 39;

const DEFAULT_REFERRAL_SOURCE = "Google LHR";


function digitsOnly(s?: string) {
  return (s ?? "").replace(/\D/g, "");
}

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
    center_name:
      g?.__center_name ??
      g?.center_name ??
      g?.center?.display_name ??
      g?.center?.name ??
      "",
    ...extractReferralDebug(g),
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

  const strongMatches = guests.filter((g) => {
    const gEmail = getGuestEmail(g);
    const gPhone = getGuestPhone(g);
    const emailMatch = em && gEmail && gEmail === em;
    const phoneMatch = ph && gPhone && gPhone === ph;
    return !!(emailMatch || phoneMatch);
  });

  if (strongMatches.length === 1) return { type: "found", guest: strongMatches[0] };

  if (strongMatches.length > 1) {
    const exactNameWithinStrong = strongMatches.filter((g) => isExactNameMatch(g, fn, ln));
    if (exactNameWithinStrong.length === 1) return { type: "found", guest: exactNameWithinStrong[0] };

    const candidateSource = exactNameWithinStrong.length > 0 ? exactNameWithinStrong : strongMatches;
    return { type: "ambiguous", candidates: toCandidates(candidateSource) };
  }

  const exactNameMatches = guests.filter((g) => isExactNameMatch(g, fn, ln));
  if (exactNameMatches.length === 1) return { type: "found", guest: exactNameMatches[0] };

  return { type: "ambiguous", candidates: toCandidates(exactNameMatches.length ? exactNameMatches : guests) };
}

function getDefaultCenterId() {
  const env = (process.env.DEFAULT_CENTER_ID ?? "").trim();
  if (env) return env;

  // Fallback: try to find Brampton by name/code, else first center.
  const br = CENTERS.find(
    (c) => c.name.toLowerCase().includes("brampton") || c.code.toLowerCase().includes("brampton")
  );
  return br?.id ?? CENTERS[0]?.id;
}

export async function POST(req: Request) {
  const reqId = crypto.randomUUID();

  try {
    const raw = await req.text();
    console.log("[lookup-or-create] RAW BODY:", raw);
    const body = raw ? JSON.parse(raw) : {};

    const address_1 = String(body.address_1 ?? "").trim();
    const city = String(body.city ?? "").trim();
    const province = String(body.province ?? "").trim();
    const zip_code = String(body.zip_code ?? "").trim();

    let cachedCanadaCountryId: number | null = null;

    async function getCanadaCountryId() {
      if (cachedCanadaCountryId) return cachedCanadaCountryId;

      const res = await zenotiFetch<any>({ method: "GET", path: "/v1/countries" });
      const list = Array.isArray(res?.countries) ? res.countries : Array.isArray(res) ? res : [];

      const canada = list.find((c: any) => String(c?.name ?? "").toLowerCase() === "canada");
      if (!canada?.id) throw new Error("Could not resolve Canada country_id from /v1/countries");

      cachedCanadaCountryId = Number(canada.id);
      return cachedCanadaCountryId;
    }


    if (!address_1 || !province || !zip_code) {
      return NextResponse.json(
        { error: "address_1, province, and zip_code are required" },
        { status: 400 }
      );
    }

    const genderRaw = body.gender;
    const gender: -1 | 0 | 1 | undefined =
      genderRaw === -1 || genderRaw === 0 || genderRaw === 1 ? genderRaw : undefined;


    // Client no longer controls center selection
    const DEFAULT_CENTER_ID = getDefaultCenterId();

    const first_name = String(body.first_name ?? "").trim();
    const last_name = String(body.last_name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phoneRaw = String(body.phone ?? "").trim();
    const phone = normalizeNorthAmericaPhone(phoneRaw);
    const date_of_birth = String(body.date_of_birth ?? "").trim(); 

    if (!first_name || !last_name) {
      return NextResponse.json({ error: "first_name and last_name are required" }, { status: 400 });
    }
    if (!phone && !email) {
      return NextResponse.json({ error: "phone or email is required" }, { status: 400 });
    }

    const base = { page: 1, size: 50 };

    // Search centers in priority order: Brampton first, then all others
    const centersOrdered = [
      DEFAULT_CENTER_ID,
      ...CENTERS.map((c) => c.id).filter((id) => id !== DEFAULT_CENTER_ID),
    ];

    const allGuests: any[] = [];

    // 1) Strong identifiers first (email/phone)
    for (const cid of centersOrdered) {
      console.log("[lookup-or-create] searching center", { reqId, cid });

      const search = await zenotiFetch<any>({
        method: "GET",
        path: "/v1/guests/search",

        
        query: {
          center_id: cid,
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          ...base,
        },
        
      });

      const guests = search?.guests ?? [];
      const centerName = CENTERS.find((c) => c.id === cid)?.name ?? "";

      for (const g of guests) {
        g.__center_id = cid;
        g.__center_name = centerName;
      }

      allGuests.push(...guests);

      // Small optimization: if we already have a unique strong match, stop early
      const early = pickBestGuest(allGuests, first_name, last_name, phone, email);
      if (early.type === "found") {
        const found = early.guest;
        const full = await fetchGuestDetails(found.id, cid);
        console.log("[lookup-or-create] full guest keys:", Object.keys(full ?? {}));
        console.log("[lookup-or-create] full.referral:", full?.referral);
        console.log("[lookup-or-create] full.referral_source id:", full?.referral?.referral_source?.id);
        console.log("[lookup-or-create] full.referral_source name:", full?.referral?.referral_source?.name);
        const referral_source_id = full?.referral?.referral_source?.id ?? null;
        const referral_source_name = full?.referral?.referral_source?.name ?? null;

        const dbg = extractReferralDebug(found);
        console.log("[lookup-or-create] referral_source_id (full):", dbg.referral_source_id);

        
        return NextResponse.json({
          created: false,
          guest: found,
          guest_id: found.id,
          resolved_center_id: DEFAULT_CENTER_ID, // we still use Brampton for the flow
          referral_debug: dbg,
        });
      }
    }

    // 2) If still nothing, broaden with name (still per-center)
    if (allGuests.length === 0) {
      for (const cid of centersOrdered) {
        const search = await zenotiFetch<any>({
          method: "GET",
          path: "/v1/guests/search",
          query: {
            center_id: cid,
            first_name,
            last_name,
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            ...base,
          },
        });

        const guests = search?.guests ?? [];
        const centerName = CENTERS.find((c) => c.id === cid)?.name ?? "";
        for (const g of guests) {
          g.__center_id = cid;
          g.__center_name = centerName;
        }
        allGuests.push(...guests);
      }
    }

    const result = pickBestGuest(allGuests, first_name, last_name, phone, email);

    if (result.type === "found") {
      const found = result.guest;

       const full = await fetchGuestDetails(found.id, DEFAULT_CENTER_ID);
       console.log("[lookup-or-create] full guest keys:", Object.keys(full ?? {}));
       console.log("[lookup-or-create] full.referral:", full?.referral);
       console.log("[lookup-or-create] full.personal_info.referral_source:", full?.personal_info?.referral_source);
       console.log("[lookup-or-create] full.referral_source:", full?.referral_source);
       const referral_source_id = full?.referral?.referral_source?.id ?? null;
       const referral_source_name = full?.referral?.referral_source?.name ?? null;

      const dbg = extractReferralDebug(full);

      console.log("[lookup-or-create] found guest referral:", extractReferralDebug(found));

      return NextResponse.json({
        created: false,
        guest: found,
        guest_id: found.id,
        resolved_center_id: DEFAULT_CENTER_ID, // force Brampton for subsequent steps
        referral_debug: dbg,
      });
    }

    if (result.type === "ambiguous") {
      return NextResponse.json(
        { created: false, ambiguous: true, candidates: result.candidates },
        { status: 409 }
      );
    }
    
    const country_id = await getCanadaCountryId();

    const createBody: any = {
      center_id: DEFAULT_CENTER_ID,

      referral: {
        referral_source: {
          id: "",
          name: "",
        },
      },
      personal_info: {
        first_name,
        last_name,
        date_of_birth,
        ...(email ? { email } : {}),
        ...(phone ? { mobile_phone: { country_code: CANADA_COUNTRY_ID, number: phone } } : {}),
        ...(gender !== undefined  ? { gender } : {}),
      },
      address_info: {
        address_1,
        city,
        country_id,
        state_id: -1,
        state_other: province,
        zip_code,
      },

      preferences: {
        receive_transactional_email: true,
        receive_transactional_sms: true,
        receive_marketing_email: false,
        receive_marketing_sms: false,
      },
    };

    console.log("[lookup-or-create] create guest payload:", JSON.stringify(createBody, null, 2));
    // 3) Create guest in Brampton (DEFAULT_CENTER_ID)
    const created = await zenotiFetch<any>({
      
      method: "POST",
      path: "/v1/guests",
      body: createBody,
      
    });

    return NextResponse.json({
      created: true,
      guest: created,
      guest_id: created?.id,
      resolved_center_id: DEFAULT_CENTER_ID,
    });
  } catch (e: any) {
    console.error("[lookup-or-create] ERROR", { message: e?.message, stack: e?.stack });
    return NextResponse.json({ error: e?.message ?? "lookup-or-create failed" }, { status: 500 });
  }
}
async function fetchGuestDetails(guestId: string, centerId: string) {
  // Some tenants require center_id; include it to be safe.
  return zenotiFetch<any>({
    method: "GET",
    path: `/v1/guests/${guestId}`,
    query: { center_id: centerId },
  });
}

function extractReferralDebug(g: any) {
  const rs = g?.referral?.referral_source;

  const referral_source_id =
    rs && typeof rs === "object" ? (rs.id ?? null) : null;

  const referral_source_name =
    rs && typeof rs === "object" ? (rs.name ?? null) : null;

  return {
    referral_obj: g?.referral ?? null,
    referral_source_obj: rs && typeof rs === "object" ? rs : null,
    referral_source_id,
    referral_source_name,
    // keep these too (some tenants store differently)
    referral_source_root: g?.referral_source ?? null,
    referral_source_personal: g?.personal_info?.referral_source ?? null,
  };
}
