"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type SessionProfile = {
  guest_id: string;
  center_id: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  phone?: string;
  display_name: string;
  relationship?: string;
};

type LoginSession = {
  user: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
  profiles: SessionProfile[];
  active_profile?: SessionProfile | null;
  logged_in_at?: string;
};

type DashboardOverview = {
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
      date: string;
      time: string;
    }>;
  };
  meta?: {
    source: string;
    fetched_at: string;
    expires_at: string;
    ttl_seconds: number;
  };
};

type OverviewCacheEntry = {
  data: DashboardOverview;
  fetched_at: string;
  expires_at: string;
};

type OverviewCacheMap = Record<string, OverviewCacheEntry>;

const SESSION_KEY = "lbmd_auth_session";
const ACTIVE_PROFILE_KEY = "lbmd_active_profile";
const OVERVIEW_CACHE_KEY = "lbmd_dashboard_overview_cache";

function getOverviewCacheMap(): OverviewCacheMap {
  try {
    const raw = sessionStorage.getItem(OVERVIEW_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OverviewCacheMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setOverviewCacheEntry(cacheKey: string, entry: OverviewCacheEntry) {
  const existing = getOverviewCacheMap();
  existing[cacheKey] = entry;
  sessionStorage.setItem(OVERVIEW_CACHE_KEY, JSON.stringify(existing));
}

function getOverviewCacheEntry(cacheKey: string): OverviewCacheEntry | null {
  const existing = getOverviewCacheMap();
  return existing[cacheKey] ?? null;
}

function formatDob(value?: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";

  const dateOnly = raw.split("T")[0];
  return dateOnly || "—";
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<LoginSession | null>(null);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      router.replace("/login");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as LoginSession;
      setSession(parsed);

      const activeRaw = sessionStorage.getItem(ACTIVE_PROFILE_KEY);
      if (activeRaw) {
        const active = JSON.parse(activeRaw) as SessionProfile;
        setActiveProfileId(active.guest_id);
        return;
      }

      const defaultProfile = parsed.active_profile ?? parsed.profiles[0] ?? null;
      if (defaultProfile) {
        setActiveProfileId(defaultProfile.guest_id);
        sessionStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(defaultProfile));
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const activeProfile = useMemo(() => {
    if (!session) return null;
    return session.profiles.find((profile) => profile.guest_id === activeProfileId) ?? null;
  }, [session, activeProfileId]);

  const greetingName = useMemo(() => {
    if (activeProfile?.first_name) return activeProfile.first_name;
    if (session?.user?.first_name) return session.user.first_name;
    return "there";
  }, [activeProfile?.first_name, session?.user?.first_name]);

  const appointmentItems = overview?.appointments?.items ?? [];
  const appointmentMessage = overview?.appointments?.message ?? "No upcoming appointments found.";

  useEffect(() => {
    if (!activeProfile) {
      setOverview(null);
      return;
    }

    const profile = activeProfile;
    const cacheKey = `${profile.guest_id}:${profile.center_id}`;
    const loginTimeMs = session?.logged_in_at ? new Date(session.logged_in_at).getTime() : 0;
    const cached = getOverviewCacheEntry(cacheKey);

    if (cached) {
      const expiresAtMs = new Date(cached.expires_at).getTime();
      const fetchedAtMs = new Date(cached.fetched_at).getTime();
      const stillFresh = expiresAtMs > Date.now();
      const freshEnoughForThisLogin = !loginTimeMs || fetchedAtMs >= loginTimeMs;

      if (stillFresh && freshEnoughForThisLogin) {
        setOverview(cached.data);
        setOverviewError(null);
        return;
      }
    }

    let cancelled = false;

    async function loadOverview() {
      setOverviewLoading(true);
      setOverviewError(null);

      try {
        const response = await fetch(
          `/api/dashboard/overview?guest_id=${encodeURIComponent(profile.guest_id)}&center_id=${encodeURIComponent(profile.center_id)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error ?? "Could not load dashboard data");
        }

        if (!cancelled) {
          const payload = data as DashboardOverview;
          setOverview(payload);

          if (payload?.meta?.fetched_at && payload?.meta?.expires_at) {
            setOverviewCacheEntry(cacheKey, {
              data: payload,
              fetched_at: payload.meta.fetched_at,
              expires_at: payload.meta.expires_at,
            });
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          setOverviewError(error?.message ?? "Could not load dashboard data");
          setOverview(null);
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, [activeProfile]);

  function onSwitchProfile(nextId: string) {
    if (!session) return;
    setActiveProfileId(nextId);

    const selected = session.profiles.find((profile) => profile.guest_id === nextId);
    if (!selected) return;

    sessionStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(selected));
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        ...session,
        active_profile: selected,
      })
    );
  }

  function onSignOut() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(ACTIVE_PROFILE_KEY);
    router.replace("/login");
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
        <p className="text-sm text-zinc-400">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 text-zinc-100">
      <section className="mx-auto w-full max-w-4xl px-6 py-10 sm:py-14">
        <motion.div
          className="rounded-3xl border border-zinc-800/90 bg-zinc-900/55 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.6)] ring-1 ring-cyan-900/20 backdrop-blur-sm sm:p-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <motion.div
            className="rounded-2xl border border-cyan-800/50 bg-gradient-to-r from-cyan-900/25 via-zinc-900/70 to-zinc-900/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/90">Client Portal</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">Hi {greetingName}</h1>
                <p className="mt-1 text-sm text-cyan-100/75">Welcome back to your LaserbodyMD dashboard</p>
                <p className="mt-2 break-all text-sm text-zinc-300">Signed in as {session.user.email}</p>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="self-start whitespace-nowrap rounded-xl border border-zinc-600 bg-zinc-900/70 px-4 py-2 text-sm text-zinc-100 shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition hover:border-cyan-600/60 hover:text-cyan-100"
              >
                Sign out
              </button>
            </div>
          </motion.div>

          <motion.div
            className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.4, ease: "easeOut" }}
          >
            <label htmlFor="active-profile" className="block text-xs uppercase tracking-wider text-zinc-400">
              Who is this for?
            </label>
            <select
              id="active-profile"
              value={activeProfileId}
              onChange={(event) => onSwitchProfile(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              {session.profiles.map((profile) => (
                <option key={profile.guest_id} value={profile.guest_id}>
                  {profile.display_name}
                </option>
              ))}
            </select>
          </motion.div>

          {overviewLoading ? <p className="mt-4 text-sm text-zinc-400">Loading data...</p> : null}
          {overviewError ? <p className="mt-4 text-sm text-rose-300">{overviewError}</p> : null}

          {overview ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <motion.div
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-sm text-zinc-300"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.4, ease: "easeOut" }}
              >
                <p className="text-zinc-100 font-medium">Profile</p>
                <div className="mt-4 space-y-2">
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Name</span>
                    <span className="text-zinc-200">{overview.guest.first_name} {overview.guest.last_name}</span>
                  </p>
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Email</span>
                    <span className="text-zinc-200">{overview.guest.email || "—"}</span>
                  </p>
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Phone</span>
                    <span className="text-zinc-200">{overview.guest.phone || "—"}</span>
                  </p>
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">DOB</span>
                    <span className="text-zinc-200">{formatDob(overview.guest.date_of_birth)}</span>
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-sm text-zinc-300"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.4, ease: "easeOut" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-zinc-100 font-medium">Upcoming appointments</p>
                  {appointmentItems.length > 0 ? (
                    <span className="rounded-full border border-cyan-800/50 bg-cyan-950/30 px-2.5 py-1 text-xs font-medium text-cyan-200">
                      {appointmentItems.length}
                    </span>
                  ) : null}
                </div>
                {appointmentItems.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {appointmentItems.map((appointment, index) => (
                      <div
                        key={`${appointment.location}-${appointment.address}-${appointment.date}-${appointment.time}-${index}`}
                        className="rounded-xl border border-zinc-800/90 bg-gradient-to-r from-zinc-900/75 to-zinc-900/55 p-4"
                      >
                        <p className="text-zinc-100 font-medium">{appointment.location}</p>
                        <p className="mt-1 text-zinc-400 text-xs sm:text-sm">{appointment.address || "Address unavailable"}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-zinc-700 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-200">
                            {appointment.date}
                          </span>
                          <span className="rounded-md border border-zinc-700 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-200">
                            {appointment.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-zinc-400">
                    {appointmentMessage}
                  </p>
                )}
              </motion.div>
            </div>
          ) : null}
        </motion.div>
      </section>
    </main>
  );
}
