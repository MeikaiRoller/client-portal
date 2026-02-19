"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useEffect, useState } from "react";

type ZenotiProfile = {
  guest_id: string;
  center_id: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  display_name: string;
  relationship?: string;
};

type SessionUser = {
  email: string;
  first_name?: string;
  last_name?: string;
};

const SESSION_KEY = "lbmd_auth_session";
const ACTIVE_PROFILE_KEY = "lbmd_active_profile";

export default function LoginPage() {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showClaim, setShowClaim] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimEmail, setClaimEmail] = useState("");
  const [claimId, setClaimId] = useState("");
  const [claimOtpCode, setClaimOtpCode] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const [claimProfiles, setClaimProfiles] = useState<ZenotiProfile[]>([]);
  const [claimSelectedProfileId, setClaimSelectedProfileId] = useState("");
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimOtpHint, setClaimOtpHint] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  function persistSessionAndGo(user: SessionUser, allProfiles: ZenotiProfile[], activeProfile?: ZenotiProfile | null) {
    const sessionProfiles = allProfiles ?? [];
    const sessionActive = activeProfile ?? sessionProfiles[0] ?? null;

    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        user,
        profiles: sessionProfiles,
        active_profile: sessionActive,
        logged_in_at: new Date().toISOString(),
      })
    );

    if (sessionActive) {
      sessionStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(sessionActive));
    } else {
      sessionStorage.removeItem(ACTIVE_PROFILE_KEY);
    }

    router.push("/dashboard");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Sign in failed");
      }

      const resolvedUser: SessionUser = {
        email: String(data?.user?.email ?? email).trim().toLowerCase(),
        first_name: String(data?.user?.first_name ?? "").trim(),
        last_name: String(data?.user?.last_name ?? "").trim(),
      };

      if (data?.zenoti?.resolution === "support_required_duplicate") {
        setError("We found duplicate records for this account. Please contact customer support to merge the profile.");
        return;
      }

      const apiProfiles: ZenotiProfile[] = Array.isArray(data?.zenoti?.profiles) ? data.zenoti.profiles : [];

      let activeProfile: ZenotiProfile | null = null;
      if (apiProfiles.length > 0) {
        activeProfile = apiProfiles[0];
      } else if (data?.zenoti?.found) {
        activeProfile = {
          guest_id: String(data?.zenoti?.guest_id ?? "").trim(),
          center_id: String(data?.zenoti?.center_id ?? "").trim(),
          first_name: String(data?.zenoti?.guest?.first_name ?? "").trim(),
          last_name: String(data?.zenoti?.guest?.last_name ?? "").trim(),
          email: String(data?.zenoti?.guest?.email ?? "").trim().toLowerCase(),
          date_of_birth: "",
          display_name: `${String(data?.zenoti?.guest?.first_name ?? "")} ${String(data?.zenoti?.guest?.last_name ?? "")}`.trim() || "Profile",
        };
      }

      if (data?.zenoti?.found) {
        const first = data?.zenoti?.guest?.first_name ?? "";
        const last = data?.zenoti?.guest?.last_name ?? "";
        const name = `${first} ${last}`.trim();
        setSuccess(name ? `Signed in. Profile matched: ${name}.` : "Signed in. Profile matched.");
      } else {
        setSuccess("Signed in. No matching profile found yet.");
      }

      persistSessionAndGo(resolvedUser, apiProfiles, activeProfile);
    } catch (submitError: any) {
      setError(submitError?.message ?? "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function startClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClaimError(null);
    setClaimMessage(null);
    setClaimOtpHint(null);
    setClaimLoading(true);

    try {
      const response = await fetch("/api/auth/claim/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: claimEmail }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not start claim");
      }

      const options: ZenotiProfile[] = Array.isArray(data?.profiles) ? data.profiles : [];
      setClaimId(String(data?.claim_id ?? ""));
      setClaimProfiles(options);
      setClaimSelectedProfileId(options[0]?.guest_id ?? "");
      setClaimMessage("Verification code sent. Enter One Time Password and set your password.");

      if (data?.otp_dev_code) {
        setClaimOtpHint(`Dev OTP: ${data.otp_dev_code}`);
      }
    } catch (error: any) {
      setClaimError(error?.message ?? "Could not start claim");
    } finally {
      setClaimLoading(false);
    }
  }

  async function completeClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClaimError(null);
    setClaimMessage(null);
    setClaimLoading(true);

    try {
      const response = await fetch("/api/auth/claim/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          claim_id: claimId,
          otp_code: claimOtpCode,
          password: claimPassword,
          selected_guest_id: claimSelectedProfileId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not complete claim");
      }

      setEmail(claimEmail);
      setPassword("");
      setClaimMessage("Account created. Please sign in with your new password.");
      setClaimError(null);
      setShowClaim(false);
      setSuccess("Account created. Sign in to continue.");
    } catch (error: any) {
      setClaimError(error?.message ?? "Could not complete claim");
    } finally {
      setClaimLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <AnimatePresence mode="wait">
        {showWelcome ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex items-center justify-center px-6"
          >
            <motion.div
              className="text-center"
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            >
              <motion.h1
                className="text-3xl sm:text-5xl font-bold tracking-tight mb-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                Welcome to
              </motion.h1>

              <motion.h2
                className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                LaserbodyMD
              </motion.h2>

              <motion.p
                className="mt-6 text-zinc-400 text-lg max-w-md mx-auto"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                Let&apos;s sign you in
              </motion.p>

              <motion.div
                className="mt-8 flex justify-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-zinc-500 rounded-full"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: 0.9 + i * 0.15,
                      repeat: Infinity,
                    }}
                  />
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        ) : (
          <section className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                <p className="mt-2 text-sm text-zinc-400">Sign in to continue.</p>
              </motion.div>

              <motion.form
                className="mt-6 space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                onSubmit={onSubmit}
              >
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm text-zinc-300">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none ring-0 placeholder:text-zinc-500 focus:border-zinc-500"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-1 block text-sm text-zinc-300">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none ring-0 placeholder:text-zinc-500 focus:border-zinc-500"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error ? <p className="text-sm text-rose-300">{error}</p> : null}
                {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </motion.form>

              <motion.div className="mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.4 }}>
                <button
                  type="button"
                  onClick={() => setShowClaim((value) => !value)}
                  className="w-full rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                >
                  {showClaim ? "Hide Claim/Register" : "Claim / Register account"}
                </button>

                {showClaim ? (
                  <div className="mt-4 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <form className="space-y-3" onSubmit={startClaim}>
                      <p className="text-sm text-zinc-300">Find your profile by email, then verify with a verification code.</p>
                      <div>
                        <label htmlFor="claim-email" className="mb-1 block text-sm text-zinc-300">
                        </label>
                        <input
                          id="claim-email"
                          type="email"
                          value={claimEmail}
                          onChange={(event) => setClaimEmail(event.target.value)}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                          placeholder="you@example.com"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={claimLoading}
                        className="w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
                      >
                        {claimLoading ? "Matching profile..." : "Send verification code"}
                      </button>
                    </form>

                    {claimId ? (
                      <form className="space-y-3 border-t border-zinc-800 pt-4" onSubmit={completeClaim}>
                        {claimProfiles.length > 1 ? (
                          <div>
                            <label htmlFor="claim-profile" className="mb-1 block text-sm text-zinc-300">
                              Select profile
                            </label>
                            <select
                              id="claim-profile"
                              value={claimSelectedProfileId}
                              onChange={(event) => setClaimSelectedProfileId(event.target.value)}
                              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            >
                              {claimProfiles.map((profile) => (
                                <option key={profile.guest_id} value={profile.guest_id}>
                                  {profile.display_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}

                        <div>
                          <label htmlFor="claim-otp" className="mb-1 block text-sm text-zinc-300">
                            Verification code
                          </label>
                          <input
                            id="claim-otp"
                            value={claimOtpCode}
                            onChange={(event) => setClaimOtpCode(event.target.value)}
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                            placeholder="6-digit code"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="claim-password" className="mb-1 block text-sm text-zinc-300">
                            New password
                          </label>
                          <input
                            id="claim-password"
                            type="password"
                            value={claimPassword}
                            onChange={(event) => setClaimPassword(event.target.value)}
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                            placeholder="Create a password"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={claimLoading}
                          className="w-full rounded-xl border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-400"
                        >
                          {claimLoading ? "Creating account..." : "Verify and create account"}
                        </button>
                      </form>
                    ) : null}

                    {claimMessage ? <p className="text-sm text-emerald-300">{claimMessage}</p> : null}
                    {claimOtpHint ? <p className="text-sm text-cyan-300">{claimOtpHint}</p> : null}
                    {claimError ? <p className="text-sm text-rose-300">{claimError}</p> : null}

                  </div>
                ) : null}
              </motion.div>
            </motion.div>
          </section>
        )}
      </AnimatePresence>
    </main>
  );
}