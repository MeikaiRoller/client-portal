"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ShieldCheck, ChevronDown, Phone, Mail, User } from "lucide-react";
import { CENTERS, type CenterId } from "../../lib/centers"; // adjust path if needed


const DEFAULT_CENTER_ID = (CENTERS.find((c) => c.code === "BR")?.id ??
  CENTERS[0].id) as CenterId;



export default function CardCapturePage() {
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 3000); // Show welcome screen for 3 seconds

    return () => clearTimeout(timer);
  }, []);


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const centerId: CenterId = DEFAULT_CENTER_ID;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");


  type GenderUI = "male" | "female" | "not_specified" | "";
  const [gender, setGender] = useState<GenderUI>("");

  const genderZenoti: -1 | 0 | 1 | null =
    gender === "male" ? 1 :
    gender === "female" ? 0 :
    gender === "not_specified" ? -1 :
    null;

  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postal, setPostal] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  const selectedCenter = CENTERS.find((c) => c.id === centerId)?.name ?? "Brampton";

  const canContinue =
    firstName.trim() &&
    lastName.trim() &&
    phone.trim().length >= 7 &&
    email.trim().includes("@") &&
    gender &&
    dob &&
    address1.trim() &&
    province.trim() &&
    postal.trim();



  const lastAttemptKey = "lbmd_card_capture_last_attempt";

  const onContinue = async () => {
    const last = Number(sessionStorage.getItem(lastAttemptKey) ?? "0");
    if (Date.now() - last < 10_000) {
      setError("Please wait a moment before trying again.");
      return;
    }
    sessionStorage.setItem(lastAttemptKey, String(Date.now()));
    setError(null);
    setLoading(true);

    try {
      setToast("Creating/locating your profile…");
      setTimeout(() => setToast(null), 2500);

      // (A) lookup-or-create guest
      const guestRes = await fetch("/api/guest/lookup-or-create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          center_id: centerId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          date_of_birth: dob,
          gender: genderZenoti,
          address_1: address1,
          city,
          province,
          zip_code: postal,
        }),
      });

      const guestData = await guestRes.json();
      if (!guestRes.ok) {
        // your API returns { error } on failures, and 409 on ambiguous
        throw new Error(guestData?.error ?? "Could not find/create guest.");
      }

      const guest_id = guestData?.guest_id;
      if (!guest_id) throw new Error("No guest_id returned from lookup/create.");

      setToast("Redirecting you to Zenoti’s secure card-entry page…");
      setTimeout(() => setToast(null), 2500);

      // (B) start hosted card capture (returns hosted_payment_uri)
      const captureRes = await fetch("/api/card-capture/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          center_id: centerId,
          guest_id,
          // later: include billing_info if AVS requires it
        }),
      });

      const captureData = await captureRes.json();
      if (!captureRes.ok) {
        throw new Error(captureData?.error ?? "Could not start card capture.");
      }

      const hosted = captureData?.hosted_payment_uri;
      if (!hosted) throw new Error("No hosted_payment_uri returned.");

      // (C) redirect user to Zenoti hosted payment page
      window.location.replace(hosted);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
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
                Let's complete your profile
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
          <>
            <div className="mx-auto max-w-3xl px-6 py-8 sm:py-14">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="rounded-3xl border border-zinc-800 bg-zinc-900/40 shadow-[0_20px_80px_rgba(0,0,0,0.6)] overflow-hidden"
              >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="p-8 sm:p-10 border-b border-zinc-800"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <img src="/laserbodymd-logo.png" alt="LaserbodyMD" className="h-10 w-auto mb-4 object-contain object-left" />
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  Secure Your Appointment
                </h1>
                <p className="mt-3 text-sm text-zinc-300 max-w-xl leading-relaxed">
                  A credit card is required to hold your appointment. You won’t be charged unless you no-show or cancel within 24 hours, in which case a $50 fee applies. Thank you for understanding.
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-300">
                <Lock className="h-4 w-4" />
                <span>Encrypted</span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-800/40 bg-cyan-950/20 p-4 text-sm text-zinc-300">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 mt-0.5 text-cyan-400" />
                <div>
                  <div className="font-medium text-cyan-300">
                    You’re always redirected for card entry.
                  </div>
                  <div className="mt-1 text-zinc-300">
                    Your contact details help us match or create your Zenoti profile, then we redirect you to a hosted page to add your card securely. Laserbody MD never holds full card details on file.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="p-8 sm:p-10"
          >
            <motion.div
              className="grid grid-cols-1 gap-5 sm:grid-cols-2"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.08,
                    delayChildren: 0.4,
                  },
                },
              }}
            >
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <Field label="First name" icon={<User className="h-4 w-4" />}>
                  <input
                    className="input px-3 py-3 pl-10"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </Field>
              </motion.div>

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <Field label="Last name" icon={<User className="h-4 w-4" />}>
                  <input
                    className="input px-3 py-3 pl-10"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </Field>
              </motion.div>

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <Field label="Phone number" icon={<Phone className="h-4 w-4" />}>
                  <input
                    className="input px-3 py-3 pl-10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(###) ### - ####"
                  />
                </Field>
              </motion.div>

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <Field label="Email" icon={<Mail className="h-4 w-4" />}>
                  <input
                    className="input px-3 py-3 pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </Field>
              </motion.div>

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <Field label="Date of birth">
                  <input
                    className="input px-3 py-3"
                    inputMode="numeric"
                    autoComplete="bday"
                    placeholder="YYYY-MM-DD"
                    value={dob}
                    maxLength={10}
                    onChange={(e) => setDob(formatDobInput(e.target.value))}
                  />
                  <div className="mt-1 text-[11px] text-zinc-400">
                    Format: YYYY-MM-DD
                  </div>
                </Field>
              </motion.div>

              <motion.div
                className="sm:col-span-2"
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <div className="mb-1 text-xs font-medium text-zinc-300">Gender</div>

                <div role="radiogroup" aria-label="Gender" className="grid grid-cols-3 gap-2">
                  {[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "not_specified", label: "Not Specified" },
                  ].map((opt) => {
                    const selected = gender === (opt.value as GenderUI);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setGender(opt.value as GenderUI)}
                        className={[
                          "rounded-2xl border px-4 py-3 text-center text-sm transition",
                          selected
                            ? "border-emerald-400/60 bg-emerald-950/30 text-emerald-100"
                            : "border-zinc-800 bg-zinc-950/30 hover:bg-zinc-950/50",
                        ].join(" ")}
                      >
                        <div className="font-medium">{opt.label}</div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>

            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/30 p-5"
            >
              <div className="text-xs font-semibold text-zinc-200 tracking-wide">
                Billing address (only required for some cards)
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                If Address Verification (AVS) is enabled, we may require billing details.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.75, duration: 0.3 }}
                >
                  <Field label="Address">
                    <input
                      className="input px-3 py-3"
                      value={address1}
                      onChange={(e) => setAddress1(e.target.value)}
                      placeholder="Street address"
                    />
                  </Field>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.82, duration: 0.3 }}
                >
                  <Field label="City">
                    <input
                      className="input px-3 py-3"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                    />
                  </Field>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.89, duration: 0.3 }}
                >
                  <Field label="Province/State">
                    <input
                      className="input px-3 py-3"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="Province/State"
                    />
                  </Field>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.96, duration: 0.3 }}
                >
                  <Field label="Postal/ZIP">
                    <input
                      className="input px-3 py-3"
                      value={postal}
                      onChange={(e) => setPostal(e.target.value)}
                      placeholder="Postal/ZIP"
                    />
                  </Field>
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.4 }}
              className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"
            >
              <p className="text-xs text-zinc-400 max-w-xl">
                By continuing, you authorize LaserbodyMD to store a card on file for the no-show policy.
              </p>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onContinue}
                disabled={!canContinue || loading}
                className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white hover:from-blue-700 hover:to-cyan-600 transition disabled:opacity-60"
              >
                {loading ? "Redirecting…" : "Continue to secure portal"}
              </motion.button>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 text-sm text-red-300"
                >
                  {error}
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
            </div>

          {toast && (
            <motion.div
              className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 backdrop-blur px-4 py-3 text-sm text-zinc-100 shadow-lg">
                {toast}
              </div>
            </motion.div>
          )}

          <style jsx global>{`
            .input {
              width: 100%;
              border-radius: 14px;
              border: 1px solid rgb(39 39 42);
              background: rgba(9, 9, 11, 0.55);
              font-size: 14px;
              outline: none;
            }
            .input:focus {
              border-color: rgb(167 243 208);
              box-shadow: 0 0 0 3px rgba(167, 243, 208, 0.08);
            }
          `}</style>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-zinc-300">{props.label}</div>
      <div className="relative">
        {props.icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300">
            {props.icon}
          </div>
        )}
        {props.children}
      </div>
    </label>
  );
}

function formatDobInput(raw: string) {
  // keep digits only
  const digits = raw.replace(/\D/g, "").slice(0, 8); // YYYYMMDD
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);

  let out = y;
  if (m) out += "-" + m;
  if (d) out += "-" + d;
  return out;
}