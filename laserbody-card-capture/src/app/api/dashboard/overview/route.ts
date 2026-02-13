import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";
import { zenotiFetch } from "@/lib/zenoti";

export const runtime = "nodejs";

type DashboardOverviewPayload = {
  guest: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    date_of_birth: string;
    phone: string;
  };
  appointments: {
    status: string;
    message: string;
  };
};

type ZenotiCacheDoc = {
  key: string;
  payload: DashboardOverviewPayload;
  fetched_at: Date;
  expires_at: Date;
  updated_at: Date;
  created_at: Date;
};

function getCacheTtlSeconds() {
  const value = Number(process.env.ZENOTI_CACHE_TTL_SECONDS ?? "900");
  if (!Number.isFinite(value) || value <= 0) return 900;
  return Math.floor(value);
}

function makeCacheKey(guestId: string, centerId: string) {
  return `guest_overview:${guestId}:${centerId || "none"}`;
}

function toIso(date: Date) {
  return new Date(date).toISOString();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const guestId = String(url.searchParams.get("guest_id") ?? "").trim();
    const centerId = String(url.searchParams.get("center_id") ?? "").trim();
    const forceRefresh = String(url.searchParams.get("force_refresh") ?? "").trim().toLowerCase() === "true";

    if (!guestId) {
      return NextResponse.json({ error: "guest_id is required" }, { status: 400 });
    }

    const db = await getMongoDb();
    const cacheCollection = db.collection<ZenotiCacheDoc>(process.env.MONGODB_ZENOTI_CACHE_COLLECTION ?? "zenoti_cache");
    const cacheKey = makeCacheKey(guestId, centerId);
    const now = new Date();
    const ttlSeconds = getCacheTtlSeconds();

    const cached = await cacheCollection.findOne({ key: cacheKey });
    const cacheIsValid =
      !forceRefresh &&
      !!cached &&
      !!cached.expires_at &&
      new Date(cached.expires_at).getTime() > now.getTime();

    if (cacheIsValid) {
      return NextResponse.json({
        ...cached.payload,
        meta: {
          source: "cache",
          fetched_at: toIso(new Date(cached.fetched_at)),
          expires_at: toIso(new Date(cached.expires_at)),
          ttl_seconds: ttlSeconds,
        },
      });
    }

    const guest = await zenotiFetch<any>({
      method: "GET",
      path: `/v1/guests/${guestId}`,
      query: centerId ? { center_id: centerId } : undefined,
    });

    const payload: DashboardOverviewPayload = {
      guest: {
        id: String(guest?.id ?? guestId),
        first_name: String(guest?.personal_info?.first_name ?? "").trim(),
        last_name: String(guest?.personal_info?.last_name ?? "").trim(),
        email: String(guest?.personal_info?.email ?? "").trim(),
        date_of_birth: String(guest?.personal_info?.date_of_birth ?? "").trim(),
        phone:
          String(guest?.personal_info?.mobile_phone?.number ?? "").trim() ||
          String(guest?.personal_info?.home_phone?.number ?? "").trim() ||
          String(guest?.personal_info?.work_phone?.number ?? "").trim(),
      },
      appointments: {
        status: "pending_endpoint",
        message: "Upcoming appointments endpoint not configured yet.",
      },
    };

    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + ttlSeconds * 1000);

    await cacheCollection.updateOne(
      { key: cacheKey },
      {
        $set: {
          key: cacheKey,
          payload,
          fetched_at: fetchedAt,
          expires_at: expiresAt,
          updated_at: fetchedAt,
        },
        $setOnInsert: {
          created_at: fetchedAt,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      ...payload,
      meta: {
        source: "zenoti",
        fetched_at: toIso(fetchedAt),
        expires_at: toIso(expiresAt),
        ttl_seconds: ttlSeconds,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to fetch dashboard data" }, { status: 500 });
  }
}
