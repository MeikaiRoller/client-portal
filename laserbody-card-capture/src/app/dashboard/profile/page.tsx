"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, CalendarDays, House, Layers, Mail, Phone, Settings, User } from "lucide-react";

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
};

const SESSION_KEY = "lbmd_auth_session";
const ACTIVE_PROFILE_KEY = "lbmd_active_profile";

function formatDob(value?: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const dateOnly = raw.split("T")[0];
  return dateOnly || "—";
}

export default function DashboardProfilePage() {
  const router = useRouter();
  const [session, setSession] = useState<LoginSession | null>(null);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          `/api/dashboard/overview?guest_id=${encodeURIComponent(profile.guest_id)}&center_id=${encodeURIComponent(profile.center_id)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error ?? "Could not load profile");
        }

        if (!cancelled) {
          setOverview(data as DashboardOverview);
        }
      } catch (profileError: any) {
        if (!cancelled) {
          setError(profileError?.message ?? "Could not load profile");
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

  if (!session) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
        <p className="text-sm text-zinc-400">Loading profile...</p>
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
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Profile</p>
                <h1 className="mt-1 text-[27px] font-semibold leading-tight tracking-tight text-zinc-100 sm:text-3xl">Your Details</h1>
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

          {loading ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 text-sm text-zinc-400">
              Loading your profile...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-4 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          {overview ? (
            <motion.div
              className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 text-[13px] text-zinc-300 sm:p-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
            >
              <div className="mt-1 grid gap-2">
                <div className="rounded-lg border border-zinc-700/80 bg-gradient-to-r from-zinc-900/75 to-zinc-900/55 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    <User className="h-3.5 w-3.5 text-zinc-500" />
                    Name
                  </p>
                  <p className="mt-1 font-medium text-zinc-100 break-words">{overview.guest.first_name} {overview.guest.last_name}</p>
                </div>
                <div className="rounded-lg border border-zinc-700/80 bg-gradient-to-r from-zinc-900/75 to-zinc-900/55 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    <Mail className="h-3.5 w-3.5 text-zinc-500" />
                    Email
                  </p>
                  <p className="mt-1 font-medium text-zinc-100 break-all">{overview.guest.email || "—"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-zinc-700/80 bg-gradient-to-r from-zinc-900/75 to-zinc-900/55 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                      <Phone className="h-3.5 w-3.5 text-zinc-500" />
                      Phone
                    </p>
                    <p className="mt-1 font-medium text-zinc-100 break-words">{overview.guest.phone || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-700/80 bg-gradient-to-r from-zinc-900/75 to-zinc-900/55 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                      <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
                      DOB
                    </p>
                    <p className="mt-1 font-medium text-zinc-100">{formatDob(overview.guest.date_of_birth)}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
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
              className="flex h-10 items-center justify-center rounded-lg text-cyan-200"
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
