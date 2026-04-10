"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { House, Sparkles, User, BadgeCheck, Settings, Package } from "lucide-react";

type SessionProfile = {
  guest_id: string;
  center_id: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  display_name: string;
  relationship?: string;
};

type LoginSession = {
  user: { email: string; first_name?: string; last_name?: string };
  profiles: SessionProfile[];
  active_profile?: SessionProfile | null;
  logged_in_at?: string;
};

type PackageService = {
  service_type_info: { name: string; duration: number };
  total: number;
  used: number;
  balance: number;
  is_void: boolean;
};

type UserPackage = {
  user_package_id: string;
  package: { name: string };
  redeemable: boolean;
  never_expires: boolean;
  date: {
    purchase_date: string;
    end: string;
    end_date_with_grace: string;
  };
  services: PackageService[];
  center: { name: string };
  redemption_setting_details: { is_frozen: boolean; center_name: string };
};

const SESSION_KEY = "lbmd_auth_session";
const ACTIVE_PROFILE_KEY = "lbmd_active_profile";

/**
 * Builds a clean customer-facing package name from the services it contains.
 * e.g. ["Chemical Peel"]           → "Chemical Peel Package"
 *      ["Venus Arms", "Chin"]      → "Venus Arms & Chin Package"
 *      ["A", "B", "C"]            → "A, B & C Package"
 *      ["A", "B", "C", "D", ...]  → "A, B & 3 more"
 */
function derivePackageName(services: PackageService[]): string {
  const names = services
    .filter((s) => !s.is_void)
    .map((s) => s.service_type_info.name)
    // deduplicate (same service in different quantities)
    .filter((name, i, arr) => arr.indexOf(name) === i);

  if (names.length === 0) return "Package";
  if (names.length === 1) return `${names[0]} Package`;
  if (names.length === 2) return `${names[0]} & ${names[1]} Package`;
  if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]} Package`;

  // 4+ — show first two then "& N more"
  const extra = names.length - 2;
  return `${names[0]}, ${names[1]} & ${extra} more`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // If year is far future treat as "never expires" visually
  if (d.getFullYear() >= 2090) return "No expiry";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" }).format(d);
}

export default function PackagesPage() {
  const router = useRouter();
  const [session, setSession] = useState<LoginSession | null>(null);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [packages, setPackages] = useState<UserPackage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load session
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as LoginSession;
      setSession(parsed);

      const activeRaw = window.sessionStorage.getItem(ACTIVE_PROFILE_KEY);
      const active = activeRaw
        ? (JSON.parse(activeRaw) as SessionProfile)
        : (parsed.active_profile ?? parsed.profiles[0] ?? null);

      if (active) setActiveProfileId(active.guest_id);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const activeProfile = useMemo(() => {
    if (!session) return null;
    return session.profiles.find((p) => p.guest_id === activeProfileId) ?? null;
  }, [session, activeProfileId]);

  // Fetch packages when active profile is ready
  useEffect(() => {
    if (!activeProfile) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPackages(null);

    fetch(
      `/api/dashboard/packages?guest_id=${encodeURIComponent(activeProfile.guest_id)}&center_id=${encodeURIComponent(activeProfile.center_id)}&show_redeemable=true&page_num=1&page_size=50`
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to fetch packages");
        // API returns the array directly or wrapped in a key
        const list: UserPackage[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.packages)
            ? data.packages
            : [];
        if (!cancelled) setPackages(list);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? "Failed to fetch packages");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProfile]);

  if (!session) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
        <p className="text-sm text-zinc-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 pb-[max(6.5rem,env(safe-area-inset-bottom))] text-zinc-100 sm:pl-20">
      <section className="mx-auto w-full max-w-md px-4 py-8 sm:max-w-4xl sm:px-6 sm:py-14">
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          {/* Header */}
          <motion.div
            className="rounded-2xl border border-zinc-800/80 bg-zinc-900/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
          >
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-100">My Packages</h1>
            {activeProfile ? (
              <p className="mt-1 text-[13px] text-zinc-400">
                {activeProfile.display_name} &middot; {session.user.email}
              </p>
            ) : null}
          </motion.div>

          {/* Loading */}
          <AnimatePresence>
            {loading ? (
              <motion.div
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 text-sm text-zinc-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                Loading packages...
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Error */}
          {error ? (
            <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-4 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          {/* Empty state */}
          {packages !== null && !loading && packages.length === 0 ? (
            <motion.div
              className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
            >
              <Package className="mx-auto h-8 w-8 text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-400">No active packages on file.</p>
            </motion.div>
          ) : null}

          {/* Package cards */}
          {packages !== null && !loading
            ? packages.map((pkg, index) => {
                const activeServices = pkg.services.filter((s) => !s.is_void);
                return (
                  <motion.div
                    key={pkg.user_package_id}
                    className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/65"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.07, duration: 0.4, ease: "easeOut" }}
                  >
                    {/* Package header */}
                    <div className="border-b border-zinc-800/60 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[14px] font-semibold leading-snug text-zinc-100">
                          {derivePackageName(pkg.services)}
                        </p>
                        <span
                          className={[
                            "mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                            pkg.redeemable && !pkg.redemption_setting_details.is_frozen
                              ? "border border-emerald-700/50 bg-emerald-950/40 text-emerald-300"
                              : "border border-zinc-700/50 bg-zinc-800/60 text-zinc-400",
                          ].join(" ")}
                        >
                          {pkg.redemption_setting_details.is_frozen
                            ? "Frozen"
                            : pkg.redeemable
                              ? "Active"
                              : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] text-zinc-400">
                        Purchased {formatDate(pkg.date.purchase_date)}
                      </p>
                    </div>

                    {/* Services */}
                    {activeServices.length > 0 ? (
                      <div className="divide-y divide-zinc-800/50">
                        {activeServices.map((service) => {
                          const pct = service.total > 0
                            ? Math.round(((service.total - service.used) / service.total) * 100)
                            : 0;
                          return (
                            <div key={service.service_type_info.name} className="px-4 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[13px] text-zinc-200">{service.service_type_info.name}</p>
                                <p className="shrink-0 text-[13px] font-medium text-zinc-100">
                                  {service.balance}
                                  <span className="text-zinc-500">/{service.total}</span>
                                </p>
                              </div>
                              {/* Progress bar */}
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className={[
                                    "h-full rounded-full transition-all",
                                    pct > 50
                                      ? "bg-cyan-500"
                                      : pct > 20
                                        ? "bg-amber-500"
                                        : "bg-rose-500",
                                  ].join(" ")}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="mt-1 text-[11px] text-zinc-500">
                                {service.used} used &middot; {service.balance} remaining
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="px-4 py-3 text-[13px] text-zinc-500">No services in this package.</p>
                    )}
                  </motion.div>
                );
              })
            : null}
        </motion.div>
      </section>

      {/* Desktop sidebar */}
      <nav className="hidden sm:flex fixed left-0 top-0 h-full w-20 flex-col items-center justify-center gap-1 border-r border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm z-30">
        <button type="button" className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 w-16">
          <Sparkles className="h-5 w-5" />
          <span className="text-[10px] tracking-wide">Packages</span>
        </button>
        <button type="button" onClick={() => router.push("/dashboard/profile")} className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200 w-16">
          <User className="h-5 w-5" />
          <span className="text-[10px] tracking-wide">Profile</span>
        </button>
        <button type="button" onClick={() => router.push("/dashboard")} className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200 w-16">
          <House className="h-5 w-5" />
          <span className="text-[10px] tracking-wide">Home</span>
        </button>
        <button type="button" onClick={() => router.push("/dashboard/memberships")} className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200 w-16">
          <BadgeCheck className="h-5 w-5" />
          <span className="text-[10px] tracking-wide">Members</span>
        </button>
        <button type="button" aria-label="Settings" className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200 w-16">
          <Settings className="h-5 w-5" />
          <span className="text-[10px] tracking-wide">Settings</span>
        </button>
      </nav>

      {/* Mobile hotbar */}
      <div className="fixed bottom-3 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:hidden">
        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-900/85 px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
          <div className="grid grid-cols-5 items-center text-zinc-400">
            <button
              type="button"
              aria-label="Packages"
              onClick={() => router.push("/dashboard/packages")}
              className="flex h-10 items-center justify-center rounded-lg text-cyan-300 transition hover:text-cyan-100"
            >
              <Sparkles className="h-4 w-4" />
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
                className="-mt-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700/60 bg-zinc-900/70 text-zinc-300 shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition hover:border-zinc-600"
              >
                <House className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              aria-label="Calendar"
              onClick={() => router.push("/dashboard/memberships")}
              className="flex h-10 items-center justify-center rounded-lg transition hover:text-zinc-200"
            >
              <BadgeCheck className="h-4 w-4" />
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
