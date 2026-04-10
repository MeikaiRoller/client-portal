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

export default function RegisterPage() {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [claimId, setClaimId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [profiles, setProfiles] = useState<ZenotiProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otpHint, setOtpHint] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  async function startClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setOtpHint(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/claim/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not start registration");
      }

      const options: ZenotiProfile[] = Array.isArray(data?.profiles) ? data.profiles : [];
      setClaimId(String(data?.claim_id ?? ""));
      setProfiles(options);
      setSelectedProfileId(options[0]?.guest_id ?? "");
      setMessage("Verification code sent to your email. Enter it below along with a new password.");

      if (data?.otp_dev_code) {
        setOtpHint(`Dev OTP: ${data.otp_dev_code}`);
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not start registration");
    } finally {
      setLoading(false);
    }
  }

  async function completeClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/claim/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          claim_id: claimId,
          otp_code: otpCode,
          password,
          selected_guest_id: selectedProfileId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not complete registration");
      }

      router.push("/login?registered=1");
    } catch (err: any) {
      setError(err?.message ?? "Could not complete registration");
    } finally {
      setLoading(false);
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
                Create your account
              </motion.h1>
              <motion.h2
                className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                LaserbodyMD
              </motion.h2>
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
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, delay: 0.9 + i * 0.15, repeat: Infinity }}
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
                <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
                <p className="mt-2 text-sm text-zinc-400">
                  Enter your email to find your profile, then verify with a one-time code.
                </p>
              </motion.div>

              <motion.form
                className="mt-6 space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                onSubmit={startClaim}
              >
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm text-zinc-300">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-500"
                    placeholder="you@example.com"
                    required
                    disabled={!!claimId}
                  />
                </div>

                {!claimId ? (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-60"
                  >
                    {loading ? "Looking up profile..." : "Send verification code"}
                  </button>
                ) : null}
              </motion.form>

              {claimId ? (
                <motion.form
                  className="mt-4 space-y-4 border-t border-zinc-800 pt-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={completeClaim}
                >
                  {profiles.length > 1 ? (
                    <div>
                      <label htmlFor="profile" className="mb-1 block text-sm text-zinc-300">
                        Select profile
                      </label>
                      <select
                        id="profile"
                        value={selectedProfileId}
                        onChange={(event) => setSelectedProfileId(event.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                      >
                        {profiles.map((profile) => (
                          <option key={profile.guest_id} value={profile.guest_id}>
                            {profile.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div>
                    <label htmlFor="otp" className="mb-1 block text-sm text-zinc-300">
                      Verification code
                    </label>
                    <input
                      id="otp"
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                      placeholder="6-digit code"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="mb-1 block text-sm text-zinc-300">
                      New password
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                      placeholder="Create a password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-60"
                  >
                    {loading ? "Creating account..." : "Verify and create account"}
                  </button>
                </motion.form>
              ) : null}

              {message ? <p className="mt-4 text-sm text-emerald-300">{message}</p> : null}
              {otpHint ? <p className="mt-2 text-sm text-cyan-300">{otpHint}</p> : null}
              {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

              <motion.div
                className="mt-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <p className="text-sm text-zinc-400">
                  Already have an account?{" "}
                  <a href="/login" className="text-zinc-200 underline underline-offset-4 hover:text-white">
                    Sign in
                  </a>
                </p>
              </motion.div>
            </motion.div>
          </section>
        )}
      </AnimatePresence>
    </main>
  );
}
