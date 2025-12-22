"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Lock, ShieldCheck, ChevronDown, Phone, Mail, User } from "lucide-react";
import { CENTERS, type CenterId } from "../../lib/centers"; // adjust path if needed




export default function CardCapturePage() {





  const [centerId, setCenterId] = useState<CenterId>(CENTERS[0].id);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postal, setPostal] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  const selectedCenter = useMemo(
    () => CENTERS.find((c) => c.id === centerId)?.name ?? "Selected location",
    [centerId]
  );

  const canContinue =
    firstName.trim() &&
    lastName.trim() &&
    phone.trim().length >= 7 &&
    email.trim().includes("@") &&
    centerId;

  const onContinue = () => {
    setToast("Next step: you’ll be redirected to Zenoti’s secure hosted card-entry page.");
    setTimeout(() => setToast(null), 3500);
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
                  Secure Card on File
                </h1>
                <p className="mt-3 text-sm text-zinc-300 max-w-xl leading-relaxed">
                  This is used to protect against no-shows. You’ll enter your card details on a secure hosted payment page.
                  LaserbodyMD does not see or store your card number.
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
                    Your contact details help us match your Zenoti profile, then we redirect you to a hosted page to add your card securely.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Preferred location">
                <div className="relative">
                  <select
                    value={centerId}
                    onChange={(e) => setCenterId(e.target.value as CenterId)}
                    className="input px-3 py-3 pr-10 appearance-none"
                  >
                    {CENTERS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none h-4 w-4 text-zinc-300 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  Selected: <span className="text-zinc-200">{selectedCenter}</span>
                </p>
              </Field>

              <div className="hidden sm:block" />

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
                disabled={!canContinue}
                className="w-full sm:w-auto rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-white transition disabled:opacity-60"
              >
                Continue to secure card entry
              </button>
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
