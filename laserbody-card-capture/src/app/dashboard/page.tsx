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
          className="rounded-3xl border border-zinc-800/90 bg-zinc-900/50 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)] sm:p-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <motion.div
            className="rounded-2xl border border-cyan-900/50 bg-gradient-to-r from-cyan-950/20 to-zinc-900/60 p-5 sm:p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Client Portal</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Hi {greetingName}</h1>
                <p className="mt-2 text-sm text-zinc-300">Signed in as {session.user.email}</p>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
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

          {overviewLoading ? <p className="mt-4 text-sm text-zinc-400">Loading Zenoti data...</p> : null}
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
                    <span className="text-zinc-200">{overview.guest.date_of_birth || "—"}</span>
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-sm text-zinc-300"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.4, ease: "easeOut" }}
              >
                <p className="text-zinc-100 font-medium">Upcoming appointments</p>
                <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-zinc-400">
                  {overview.appointments.message}
                </p>
              </motion.div>
            </div>
          ) : null}
        </motion.div>
      </section>
    </main>
  );
}
