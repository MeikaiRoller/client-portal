"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { House, Sparkles, User, BadgeCheck, Settings, Tag } from "lucide-react";

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

type MembershipService = {
  service: { name: string };
  total: number;
  balance: number;
  used: number;
  frequncy: string;
  frequency_in_days: number;
  last_usage_date: string | null;
  accrued_on: string | null;
};

type MembershipProduct = {
  product_benefit_name: string;
  product_benefit_type: string;
  discount: string;
};

type GuestMembership = {
  user_membership_id: string;
  status: number;
  recurrence_status: number;
  membership: { name: string; code: string };
  member_code: string;
  member_since: string;
  expiry_date: string | null;
  next_collection_date: string | null;
  next_collection_amount: number | null;
  services: MembershipService[];
  products: MembershipProduct[];
  upgrade_options: Array<{ name: string; price: number }>;
};

type MembershipsResponse = {
  guest_memberships: GuestMembership[];
};

const SESSION_KEY = "lbmd_auth_session";
const ACTIVE_PROFILE_KEY = "lbmd_active_profile";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" }).format(d);
}

function statusLabel(status: number, recurrence: number) {
  if (status === 1 && recurrence === 1) return { text: "Active", active: true };
  if (status === 2) return { text: "Frozen", active: false };
  if (status === 3) return { text: "Cancelled", active: false };
  return { text: "Inactive", active: false };
}

/**
 * Add N months to a date. If the target day doesn't exist in the resulting
 * month (e.g. Jan 31 + 1 month → Feb has no 31st), move to the 1st of
 * the following month instead of silently overflowing mid-month.
 */
function addMonthsClamped(date: Date, months: number): Date {
  const targetDay = date.getDate();
  const result = new Date(date);
  result.setDate(1); // anchor to 1st to prevent setMonth overflow artefacts
  result.setMonth(result.getMonth() + months);
  const daysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  if (targetDay <= daysInMonth) {
    result.setDate(targetDay);
  } else {
    // Day doesn't exist in this month → 1st of the next month
    result.setMonth(result.getMonth() + 1);
    result.setDate(1);
  }
  return result;
}

/**
 * Calculates the next future credit accrual date for a membership service.
 * Interval is derived from `frequency_in_days` or the `frequncy` string.
 * Returns null if the interval cannot be determined.
 */
function computeNextAccrual(svc: MembershipService): Date | null {
  const baseIso = svc.accrued_on;
  if (!baseIso) return null;

  const base = new Date(baseIso);
  if (Number.isNaN(base.getTime())) return null;

  // Determine the accrual interval in months
  let monthsInterval: number | null = null;

  const fd = svc.frequency_in_days;
  if (fd >= 28 && fd <= 31) {
    monthsInterval = 1;
  } else if (fd >= 85 && fd <= 95) {
    monthsInterval = 3;
  } else {
    // Fall back to the frequncy string (note Zenoti typo)
    const f = (svc.frequncy ?? "").toLowerCase();
    if (f.includes("month")) monthsInterval = 1;
    else if (f.includes("quarter")) monthsInterval = 3;
  }

  if (monthsInterval === null) return null;

  const now = new Date();
  let next = addMonthsClamped(base, monthsInterval);

  // Advance until we land in the future
  while (next <= now) {
    next = addMonthsClamped(next, monthsInterval);
  }

  return next;
}

export default function MembershipsPage() {
  const router = useRouter();
  const [session, setSession] = useState<LoginSession | null>(null);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [memberships, setMemberships] = useState<GuestMembership[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!activeProfile) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setMemberships(null);

    fetch(
      `/api/dashboard/memberships?guest_id=${encodeURIComponent(activeProfile.guest_id)}&center_id=${encodeURIComponent(activeProfile.center_id)}`
    )
      .then(async (res) => {
        const data = await res.json() as MembershipsResponse;
        if (!res.ok) throw new Error((data as any)?.error ?? "Failed to fetch memberships");
        const list = Array.isArray(data?.guest_memberships) ? data.guest_memberships : [];
        if (!cancelled) setMemberships(list);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? "Failed to fetch memberships");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
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
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-100">Memberships</h1>
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
                Loading memberships...
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
          {memberships !== null && !loading && memberships.length === 0 ? (
            <motion.div
              className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
            >
              <BadgeCheck className="mx-auto h-8 w-8 text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-400">No active memberships on file.</p>
            </motion.div>
          ) : null}

          {/* Membership cards */}
          {memberships !== null && !loading
            ? memberships.map((m, index) => {
                const { text: statusText, active: isActive } = statusLabel(m.status, m.recurrence_status);
                return (
                  <motion.div
                    key={m.user_membership_id}
                    className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/65"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.07, duration: 0.4, ease: "easeOut" }}
                  >
                    {/* Card header */}
                    <div className="border-b border-zinc-800/60 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[14px] font-semibold leading-snug text-zinc-100">
                          {m.membership.name}
                        </p>
                        <span
                          className={[
                            "mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                            isActive
                              ? "border border-emerald-700/50 bg-emerald-950/40 text-emerald-300"
                              : "border border-zinc-700/50 bg-zinc-800/60 text-zinc-400",
                          ].join(" ")}
                        >
                          {statusText}
                        </span>
                      </div>

                      {/* Meta row */}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-400">
                        <span>Member since {formatDate(m.member_since)}</span>
                      </div>

                      {/* Next billing */}
                      {m.next_collection_date && m.next_collection_amount != null ? (
                        <p className="mt-1.5 text-[12px] text-zinc-400">
                          Next billing{" "}
                          <span className="text-zinc-200">
                            ${m.next_collection_amount}
                          </span>{" "}
                          on {formatDate(m.next_collection_date)}
                        </p>
                      ) : null}
                    </div>

                    {/* Service credits */}
                    {m.services.length > 0 ? (
                      <div className="divide-y divide-zinc-800/50">
                        <p className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                          Included credits
                        </p>
                        {m.services.map((svc, si) => {
                          const pct = svc.total > 0
                            ? Math.round((svc.balance / svc.total) * 100)
                            : 100;
                          const nextAccrual = computeNextAccrual(svc);
                          return (
                            <div key={`${svc.service.name}-${si}`} className="px-4 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[13px] text-zinc-200">{svc.service.name}</p>
                                <p className="shrink-0 text-[13px] font-medium text-zinc-100">
                                  {svc.balance}
                                  <span className="text-zinc-500">/{svc.total}</span>
                                </p>
                              </div>
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className={[
                                    "h-full rounded-full",
                                    pct > 50 ? "bg-cyan-500" : pct > 20 ? "bg-amber-500" : "bg-rose-500",
                                  ].join(" ")}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="mt-1 text-[11px] text-zinc-500">
                                {svc.used} used &middot; {svc.balance} remaining
                                {svc.last_usage_date ? ` · Last used ${formatDate(svc.last_usage_date)}` : ""}
                              </p>
                              {nextAccrual ? (
                                <p className="mt-1 text-[11px] text-cyan-400/80">
                                  Next credit {formatDate(nextAccrual.toISOString())}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {/* Product discounts */}
                    {m.products.length > 0 ? (
                      <div className="border-t border-zinc-800/60 px-4 py-3">
                        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                          Member discounts
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {m.products.map((p, pi) => (
                            <span
                              key={pi}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1 text-[12px] text-zinc-200"
                            >
                              <Tag className="h-3 w-3 text-zinc-500" />
                              {p.discount} off {p.product_benefit_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Upgrade options */}
                    {m.upgrade_options.length > 0 ? (
                      <div className="border-t border-zinc-800/60 px-4 py-3">
                        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                          Upgrade available
                        </p>
                        {m.upgrade_options.map((u, ui) => (
                          <p key={ui} className="text-[12px] text-zinc-400">
                            {u.name}
                            {u.price ? (
                              <span className="ml-2 text-zinc-300">${u.price}/mo</span>
                            ) : null}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </motion.div>
                );
              })
            : null}
        </motion.div>
      </section>

      {/* Desktop sidebar */}
      <nav className="hidden sm:flex fixed left-0 top-0 h-full w-20 flex-col items-center justify-center gap-1 border-r border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm z-30">
        <button type="button" onClick={() => router.push("/dashboard/packages")} className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200 w-16">
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
        <button type="button" className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 w-16">
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
              className="flex h-10 items-center justify-center rounded-lg transition hover:text-zinc-200"
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
              aria-label="Memberships"
              className="flex h-10 items-center justify-center rounded-lg text-cyan-300 transition hover:text-cyan-100"
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
