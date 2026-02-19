"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Clock3, House, Layers, MapPin, Settings, User } from "lucide-react";

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

type AppointmentItem = {
  starts_at: string;
  location: string;
  address: string;
  date: string;
  time: string;
};

type DashboardOverview = {
  appointments: {
    status: string;
    message: string;
    items: AppointmentItem[];
  };
};

const SESSION_KEY = "lbmd_auth_session";
const ACTIVE_PROFILE_KEY = "lbmd_active_profile";

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromStartsAtToKey(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return dayKey(parsed);
}

function buildMonthCells(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekdayMondayBased = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ date: Date | null; key: string }> = [];

  for (let i = 0; i < firstWeekdayMondayBased; i += 1) {
    cells.push({ date: null, key: `empty-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date, key: dayKey(date) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `tail-${cells.length}` });
  }

  return cells;
}

export default function DashboardCalendarPage() {
  const router = useRouter();
  const [session, setSession] = useState<LoginSession | null>(null);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState(() => dayKey(new Date()));

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
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const activeProfile = useMemo(() => {
    if (!session) return null;
    return session.profiles.find((profile) => profile.guest_id === activeProfileId) ?? null;
  }, [session, activeProfileId]);

  useEffect(() => {
    if (!activeProfile) return;
    const profile = activeProfile;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/dashboard/overview?guest_id=${encodeURIComponent(profile.guest_id)}&center_id=${encodeURIComponent(profile.center_id)}&force_refresh=true`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error ?? "Could not load calendar appointments");
        }

        if (!cancelled) {
          const payload = data as DashboardOverview;
          setOverview(payload);

          const first = payload.appointments.items[0];
          if (first?.starts_at) {
            const firstDate = new Date(first.starts_at);
            if (!Number.isNaN(firstDate.getTime())) {
              setSelectedDayKey(dayKey(firstDate));
              setMonthCursor(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
            }
          }
        }
      } catch (calendarError: any) {
        if (!cancelled) {
          setError(calendarError?.message ?? "Could not load calendar appointments");
          setOverview(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeProfile]);

  const appointmentItems = overview?.appointments?.items ?? [];

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentItem[]>();

    for (const item of appointmentItems) {
      const key = fromStartsAtToKey(item.starts_at);
      if (!key) continue;
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    }

    for (const [key, items] of map.entries()) {
      items.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
      map.set(key, items);
    }

    return map;
  }, [appointmentItems]);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      month: "long",
      year: "numeric",
    }).format(monthCursor);
  }, [monthCursor]);

  const monthCells = useMemo(() => buildMonthCells(monthCursor), [monthCursor]);

  const selectedDayAppointments = appointmentsByDay.get(selectedDayKey) ?? [];

  if (!session) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
        <p className="text-sm text-zinc-400">Loading calendar...</p>
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Calendar</p>
                <h1 className="mt-1 text-[27px] font-semibold leading-tight tracking-tight text-zinc-100 sm:text-3xl">
                  Appointments
                </h1>
              </div>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-[11px] font-medium tracking-[0.02em] text-zinc-200"
              >
                Back
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
              onChange={(event) => {
                setActiveProfileId(event.target.value);
                const selected = session.profiles.find((profile) => profile.guest_id === event.target.value);
                if (!selected) return;
                sessionStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(selected));
              }}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-[13px] text-zinc-100 outline-none focus:border-zinc-500"
            >
              {session.profiles.map((profile) => (
                <option key={profile.guest_id} value={profile.guest_id}>
                  {profile.display_name}
                </option>
              ))}
            </select>
          </motion.div>

          {loading ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 text-sm text-zinc-400">
              Loading calendar...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-4 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          <motion.div
            className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 sm:p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="rounded-lg border border-zinc-700/80 bg-zinc-900/70 p-2 text-zinc-300"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold text-zinc-100">{monthLabel}</p>
              <button
                type="button"
                onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="rounded-lg border border-zinc-700/80 bg-zinc-900/70 p-2 text-zinc-300"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2 text-center">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                <div key={label} className="text-[11px] text-zinc-500">
                  {label}
                </div>
              ))}

              {monthCells.map((cell) => {
                if (!cell.date) {
                  return <div key={cell.key} className="h-12 rounded-lg" />;
                }

                const key = dayKey(cell.date);
                const count = appointmentsByDay.get(key)?.length ?? 0;
                const isSelected = key === selectedDayKey;

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDayKey(key)}
                    className={[
                      "h-12 rounded-lg border text-center transition",
                      isSelected
                        ? "border-cyan-700/60 bg-cyan-500/20 text-cyan-100"
                        : "border-zinc-700/80 bg-zinc-900/70 text-zinc-200",
                    ].join(" ")}
                  >
                    <div className="text-xs font-medium">{cell.date.getDate()}</div>
                    {count > 0 ? <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" /> : null}
                  </button>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 text-[13px] text-zinc-300 sm:p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] font-semibold text-zinc-100">Selected day</p>
              <span className="rounded-full border border-cyan-800/50 bg-cyan-950/30 px-2.5 py-1 text-xs font-medium text-cyan-200">
                {selectedDayAppointments.length}
              </span>
            </div>

            {selectedDayAppointments.length > 0 ? (
              <div className="mt-4 space-y-3">
                {selectedDayAppointments.map((appointment, index) => (
                  <div
                    key={`${appointment.starts_at}-${appointment.location}-${index}`}
                    className="rounded-xl border border-zinc-700/80 bg-gradient-to-r from-zinc-900/75 to-zinc-900/55 p-4"
                  >
                    <p className="flex items-center gap-2 text-zinc-100 font-medium">
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
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  No appointments for this day.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      </section>

      <div className="fixed bottom-3 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:hidden">
        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-900/85 px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
          <div className="grid grid-cols-5 items-center text-zinc-400">
            <button
              type="button"
              aria-label="Overview"
              onClick={() => router.push("/dashboard")}
              className="flex h-10 items-center justify-center rounded-lg transition hover:text-zinc-200"
            >
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
              className="flex h-10 items-center justify-center rounded-lg text-cyan-200"
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
