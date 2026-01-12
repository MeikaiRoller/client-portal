"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Lock, ShieldCheck, ChevronDown, Phone, Mail, User } from "lucide-react";
import { CENTERS, type CenterId } from "../../lib/centers"; // adjust path if needed


const DEFAULT_CENTER_ID = (CENTERS.find((c) => c.code === "BR")?.id ??
  CENTERS[0].id) as CenterId;



export default function CardCapturePage() {




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
      <div className="mx-auto max-w-3xl px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-zinc-800 bg-zinc-900/40 shadow-[0_20px_80px_rgba(0,0,0,0.6)] overflow-hidden"
        >
          <div className="p-8 sm:p-10 border-b border-zinc-800">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-zinc-400">
                  LaserbodyMD
                </div>
                <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
                  Create Account
                </h1>
                <p className="mt-3 text-sm text-zinc-300 max-w-xl leading-relaxed">
                  A credit card is required on file to secure your appointment. No charges will be made unless you no-show or cancel with less than 24 hours’ notice, in which case a $50 cancellation fee will apply. Thank you for your understanding.
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-300">
                <Lock className="h-4 w-4" />
                <span>Encrypted</span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-300">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 mt-0.5" />
                <div>
                  <div className="font-medium text-zinc-100">
                    You’re always redirected for card entry.
                  </div>
                  <div className="mt-1 text-zinc-300">
                    Your contact details help us match or create your Zenoti profile, then we redirect you to a hosted page to add your card securely.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="First name" icon={<User className="h-4 w-4" />}>
                <input
                  className="input px-3 py-3 pl-10"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </Field>

              <Field label="Last name" icon={<User className="h-4 w-4" />}>
                <input
                  className="input px-3 py-3 pl-10"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </Field>

              <Field label="Phone number" icon={<Phone className="h-4 w-4" />}>
                <input
                  className="input px-3 py-3 pl-10"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(###) ### - ####"
                />
              </Field>

              <Field label="Email" icon={<Mail className="h-4 w-4" />}>
                <input
                  className="input px-3 py-3 pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
              </Field>

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


              <div className="sm:col-span-2">
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
                            ? "border-zinc-100/60 bg-zinc-100/10"
                            : "border-zinc-800 bg-zinc-950/30 hover:bg-zinc-950/50",
                        ].join(" ")}
                      >
                        <div className="font-medium text-zinc-100">{opt.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/30 p-5">
              <div className="text-xs font-semibold text-zinc-200 tracking-wide">
                Billing address (only required for some cards)
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                If Address Verification (AVS) is enabled, we may require billing details.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Address">
                  <input
                    className="input px-3 py-3"
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    placeholder="Street address"
                  />
                </Field>
                <Field label="City">
                  <input
                    className="input px-3 py-3"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                  />
                </Field>
                <Field label="Province/State">
                  <input
                    className="input px-3 py-3"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="Province/State"
                  />
                </Field>
                <Field label="Postal/ZIP">
                  <input
                    className="input px-3 py-3"
                    value={postal}
                    onChange={(e) => setPostal(e.target.value)}
                    placeholder="Postal/ZIP"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-400 max-w-xl">
                By continuing, you authorize LaserbodyMD to store a card on file for the no-show policy.
              </p>

              <button
                onClick={onContinue}
                disabled={!canContinue || loading}
                className="w-full sm:w-auto rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-white transition disabled:opacity-60"
              >
                {loading ? "Redirecting…" : "Continue to secure portal"}
              </button>
              {error && (
                <div className="mt-3 text-sm text-red-300">
                  {error}
                </div>
              )}

            </div>
          </div>
        </motion.div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 backdrop-blur px-4 py-3 text-sm text-zinc-100 shadow-lg">
            {toast}
          </div>
        </div>
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
          border-color: rgb(161 161 170);
        }
      `}</style>
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