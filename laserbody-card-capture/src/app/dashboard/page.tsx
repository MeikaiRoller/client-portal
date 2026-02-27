"use client";
import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, CalendarDays, Clock3, Mail, MapPin, Phone, User } from "lucide-react";
import { House, Layers, Settings } from "lucide-react";

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
      starts_at: string;
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

function toScheduleDateParts(value: string) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      weekday: new Intl.DateTimeFormat("en-CA", { weekday: "short" }).format(parsed),
      day: new Intl.DateTimeFormat("en-CA", { day: "2-digit" }).format(parsed),
    };
  }

  const parts = value.split(",");
  const weekday = (parts[0] ?? "Day").trim().slice(0, 3) || "Day";
  const dayMatch = (parts[1] ?? "").match(/\d+/);

  return {
    weekday,
    day: dayMatch?.[0]?.padStart(2, "0") ?? "--",
  };
}

export default function DashboardPage() {
    const [showLoading, setShowLoading] = useState(false);
    const [session, setSession] = useState<LoginSession | null>(null);
    const [activeProfileId, setActiveProfileId] = useState("");
    const [overview, setOverview] = useState<DashboardOverview | null>(null);
    const [overviewLoading, setOverviewLoading] = useState(false);
    const [overviewError, setOverviewError] = useState<string | null>(null);

    useEffect(() => {
      let timer: NodeJS.Timeout | null = null;
      if (overviewLoading) {
        timer = setTimeout(() => setShowLoading(true), 150);
      } else {
        setShowLoading(false);
        if (timer) clearTimeout(timer);
      }
      return () => {
        if (timer) clearTimeout(timer);
      };
    }, [overviewLoading]);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      // Fallback: fetch user/profile from API using JWT cookie
      fetch("/api/auth/me")
        .then(async (res) => {
          if (!res.ok) throw new Error("Not authenticated");
          const data = await res.json();
          if (!data?.user) throw new Error("No user data");
          // Hydrate sessionStorage
          window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
          setSession(data);
          if (data.active_profile) {
            window.sessionStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(data.active_profile));
            setActiveProfileId(data.active_profile.guest_id);
          } else if (Array.isArray(data.profiles) && data.profiles.length > 0) {
            window.sessionStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(data.profiles[0]));
            setActiveProfileId(data.profiles[0].guest_id);
          }
        })
        .catch(() => {
          router.replace("/login");
        });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as LoginSession;
      setSession(parsed);

      const activeRaw = window.sessionStorage.getItem(ACTIVE_PROFILE_KEY);
      if (activeRaw) {
        const active = JSON.parse(activeRaw) as SessionProfile;
        setActiveProfileId(active.guest_id);
        return;
      }

      const defaultProfile = parsed.active_profile ?? parsed.profiles[0] ?? null;
      if (defaultProfile) {
        setActiveProfileId(defaultProfile.guest_id);
        window.sessionStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(defaultProfile));
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

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date());
  }, []);

  const appointmentItems = overview?.appointments?.items ?? [];
  const appointmentMessage = overview?.appointments?.message ?? "No upcoming appointments found.";
  const nextAppointment = appointmentItems[0] ?? null;

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

  async function onSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
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
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 pb-[max(6.5rem,env(safe-area-inset-bottom))] text-zinc-100">
      <section className="mx-auto w-full max-w-md px-4 py-8 sm:max-w-4xl sm:px-6 sm:py-14">
        <motion.div
          className="space-y-4 sm:space-y-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <motion.div
            className="rounded-2xl border border-zinc-800/80 bg-zinc-900/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] tracking-[0.02em] text-zinc-400">{todayLabel}</p>
                <h1 className="mt-1 text-[27px] font-semibold leading-tight tracking-tight text-zinc-100 sm:text-3xl">Hi {greetingName}</h1>
                <p className="mt-2 break-all text-[13px] text-zinc-300">{session.user.email}</p>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="self-start whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-[11px] font-medium tracking-[0.02em] text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                Sign out
              </button>
            </div>
          </motion.div>

          <motion.div
            className="rounded-2xl border border-zinc-800/80 bg-zinc-900/65 p-4 sm:p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.4, ease: "easeOut" }}
          >
            <label htmlFor="active-profile" className="block text-[11px] uppercase tracking-[0.16em] text-zinc-400">
              Who is this for?
            </label>
            <select
              id="active-profile"
              value={activeProfileId}
              onChange={(event) => onSwitchProfile(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-[13px] text-zinc-100 outline-none focus:border-zinc-500"
            >
              {session.profiles.map((profile) => (
                <option key={profile.guest_id} value={profile.guest_id}>
                  {profile.display_name}
                </option>
              ))}
            </select>
          </motion.div>

          {appointmentItems.length > 0 ? (
            <motion.div
              className="rounded-2xl border border-zinc-800/80 bg-zinc-900/55 p-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.17, duration: 0.35, ease: "easeOut" }}
            >
              <p className="px-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">Schedule</p>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {appointmentItems.slice(0, 6).map((appointment, index) => {
                  const dateParts = toScheduleDateParts(appointment.date);
                  const isPrimary = index === 0;

                  return (
                    <div
                      key={`${appointment.location}-${appointment.date}-${index}-pill`}
                      className={[
                        "min-w-[68px] rounded-lg border px-3 py-2 text-center",
                        isPrimary
                          ? "border-cyan-700/60 bg-cyan-500/20"
                          : "border-zinc-700/80 bg-zinc-900/70",
                      ].join(" ")}
                    >
                      <p className={isPrimary ? "text-[11px] text-cyan-100" : "text-[11px] text-zinc-400"}>{dateParts.weekday}</p>
                      <p className={isPrimary ? "mt-1 text-base font-semibold text-cyan-50" : "mt-1 text-base font-semibold text-zinc-200"}>{dateParts.day}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : null}

          {nextAppointment ? (
            <motion.div
              className="rounded-2xl border border-cyan-900/45 bg-gradient-to-r from-cyan-950/25 to-zinc-900/70 p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.35, ease: "easeOut" }}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">Next Appointment</p>
              <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-zinc-100">
                <MapPin className="h-3.5 w-3.5 text-cyan-200/75" />
                {nextAppointment.location}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-zinc-300">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
                  {nextAppointment.date}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 text-zinc-500" />
                  {nextAppointment.time}
                </span>
              </p>
            </motion.div>
          ) : null}

          <AnimatePresence>
            {showLoading ? (
              <motion.div
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 text-sm text-zinc-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                Loading your dashboard...
              </motion.div>
            ) : null}
          </AnimatePresence>
          {overviewError ? (
            <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-4 text-sm text-rose-300">
              {overviewError}
            </div>
          ) : null}

          {overview ? (
            <motion.div
                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 text-[13px] text-zinc-300 sm:p-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.4, ease: "easeOut" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-semibold text-zinc-100">Upcoming appointments</p>
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
                        className={[
                          "relative overflow-hidden rounded-xl border border-zinc-700/80 bg-gradient-to-r from-zinc-900/75 to-zinc-900/55 p-4",
                          index === 0
                            ? "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-cyan-400/70"
                            : "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-violet-400/45",
                        ].join(" ")}
                      >
                        <p className="flex items-center gap-2 text-zinc-100 font-medium">
                          <span
                            className={[
                              "inline-block h-2 w-2 rounded-full",
                              index === 0 ? "bg-cyan-300" : "bg-violet-300/80",
                            ].join(" ")}
                          />
                          <MapPin className="h-3.5 w-3.5 text-cyan-200/75" />
                          {appointment.location}
                        </p>
                        <p className="mt-1 text-zinc-400 text-xs sm:text-sm">{appointment.address || "Address unavailable"}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-200">
                            <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
                            {appointment.date}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-200">
                            <Clock3 className="h-3.5 w-3.5 text-zinc-500" />
                            {appointment.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-zinc-400">
                    <p className="flex items-center gap-2 text-zinc-300">
                      <CalendarDays className="h-4 w-4 text-zinc-500" />
                      {appointmentMessage}
                    </p>
                  </div>
                )}
            </motion.div>
          ) : null}
        </motion.div>
      </section>

      <div className="fixed bottom-3 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:hidden">
        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-900/85 px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
          <div className="grid grid-cols-5 items-center text-zinc-400">
            <button type="button" aria-label="Overview" className="flex h-10 items-center justify-center rounded-lg transition hover:text-zinc-200">
              <Layers className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Profile"
              onClick={() => router.push("/dashboard/profile")}
              className="flex h-10 items-center justify-center rounded-lg transition hover:text-zinc-200"
            >
              <User className="h-4 w-4" />
            </button>
            <div className="flex items-center justify-center">
              <button
                type="button"
                aria-label="Home"
                onClick={() => router.push("/dashboard")}
                className="-mt-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/40 bg-cyan-500/25 text-cyan-100 shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
              >
                <House className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              aria-label="Calendar"
              onClick={() => router.push("/dashboard/calendar")}
              className="flex h-10 items-center justify-center rounded-lg transition hover:text-zinc-200"
            >
              <Calendar className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Settings" className="flex h-10 items-center justify-center rounded-lg transition hover:text-zinc-200">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
