import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getMongoDb } from "@/lib/mongodb";
import { zenotiFetch } from "@/lib/zenoti";
import { CENTERS } from "@/lib/centers";

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
    items: Array<{
      location: string;
      address: string;
      starts_at: string;
      date: string;
      time: string;
    }>;
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

function getAppointmentsLookaheadDays() {
  const value = Number(process.env.ZENOTI_APPOINTMENTS_LOOKAHEAD_DAYS ?? "180");
  if (!Number.isFinite(value) || value <= 0) return 180;
  return Math.floor(value);
}

function makeCacheKey(guestId: string, centerId: string, lookaheadDays: number) {
  return `guest_overview:${guestId}:${centerId || "none"}:d${lookaheadDays}`;
}

function toIso(date: Date) {
  return new Date(date).toISOString();
}

function toDateParam(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toCenterName(centerId: string) {
  if (!centerId) return "Location unavailable";
  return CENTERS.find((center) => center.id === centerId)?.name ?? "Location unavailable";
}

function toCenterAddress(centerId: string) {
  if (!centerId) return "Address unavailable";
  return CENTERS.find((center) => center.id === centerId)?.address ?? "Address unavailable";
}

function toDateTimeLabels(value: string) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    return { date: "Date unavailable", time: "Time unavailable" };
  }

  return {
    date: new Intl.DateTimeFormat("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsed),
    time: new Intl.DateTimeFormat("en-CA", {
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed),
  };
}

function extractAppointmentGroups(input: any): any[] {
  if (Array.isArray(input?.appointments)) return input.appointments;
  if (Array.isArray(input?.appointments?.items)) return input.appointments.items;
  if (Array.isArray(input?.appointments?.appointment_groups)) return input.appointments.appointment_groups;
  if (Array.isArray(input?.appointment_groups)) return input.appointment_groups;
  return [];
}

function normalizeUpcomingAppointments(input: any, now: Date) {
  const groups = extractAppointmentGroups(input);

  const normalized = groups
    .map((group) => {
      const services = Array.isArray(group?.appointment_services) ? group.appointment_services : [];
      const startTime =
        String(services[0]?.start_time ?? "").trim() ||
        String(group?.start_time ?? "").trim();

      if (!startTime) return null;

      const start = new Date(startTime);
      if (Number.isNaN(start.getTime()) || start.getTime() < now.getTime()) return null;

      const centerId =
        String(group?.center_id ?? "").trim() ||
        String(services[0]?.center_id ?? "").trim();

      const labels = toDateTimeLabels(startTime);

      return {
        startsAtMs: start.getTime(),
        starts_at: start.toISOString(),
        location: toCenterName(centerId),
        address: toCenterAddress(centerId),
        date: labels.date,
        time: labels.time,
      };
    })
    .filter((item): item is { startsAtMs: number; starts_at: string; location: string; address: string; date: string; time: string } => !!item)
    .sort((a, b) => a.startsAtMs - b.startsAtMs)
    .map(({ starts_at, location, address, date, time }) => ({ starts_at, location, address, date, time }));

  return normalized;
}

export async function GET(req: Request) {
  // Require valid session (JWT cookie)
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    const lookaheadDays = getAppointmentsLookaheadDays();
    const cacheKey = makeCacheKey(guestId, centerId, lookaheadDays);
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

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + lookaheadDays);

    let appointmentItems: DashboardOverviewPayload["appointments"]["items"] = [];
    let appointmentsStatus = "ok";
    let appointmentsMessage = "No upcoming appointments found.";

    try {
      const pageSize = 50;
      const maxPages = 8;
      const allAppointmentGroups: any[] = [];

      for (let page = 1; page <= maxPages; page += 1) {
        const appointmentsResponse = await zenotiFetch<any>({
          method: "GET",
          path: `/v1/guests/${guestId}/appointments`,
          query: {
            page,
            size: pageSize,
            start_date: toDateParam(startDate),
            end_date: toDateParam(endDate),
          },
        });

        const groups = extractAppointmentGroups(appointmentsResponse);
        if (groups.length === 0) break;

        allAppointmentGroups.push(...groups);

        if (groups.length < pageSize) break;
      }

      appointmentItems = normalizeUpcomingAppointments({ appointment_groups: allAppointmentGroups }, startDate);
      appointmentsMessage =
        appointmentItems.length > 0
          ? ""
          : "No upcoming appointments found.";
    } catch {
      appointmentsStatus = "unavailable";
      appointmentsMessage = "Upcoming appointments are temporarily unavailable.";
      appointmentItems = [];
    }

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
        status: appointmentsStatus,
        message: appointmentsMessage,
        items: appointmentItems,
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
