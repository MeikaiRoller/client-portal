import { NextResponse } from "next/server";
import { CENTERS } from "@/lib/centers";
import { getMongoDb } from "@/lib/mongodb";
import { createPasswordHash } from "@/lib/password";
import { sendOtpEmail } from "@/lib/otp-email";
import { zenotiFetch } from "@/lib/zenoti";

export const runtime = "nodejs";

type ClaimProfile = {
  guest_id: string;
  center_id: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  phone: string;
  display_name: string;
};

type ClaimSessionDoc = {
  claim_id: string;
  email: string;
  email_normalized: string;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  profiles: ClaimProfile[];
  resolution: "single" | "multi_profile";
  completed?: boolean;
  created_at: Date;
  updated_at: Date;
};

function normEmail(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function normName(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function normDob(value?: string) {
  return (value ?? "").trim();
}

function normPhone(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function profileFromGuest(guest: any, centerId: string): ClaimProfile | null {
  const guestId = String(guest?.id ?? "").trim();
  if (!guestId) return null;

  const firstName = String(guest?.personal_info?.first_name ?? "").trim();
  const lastName = String(guest?.personal_info?.last_name ?? "").trim();

  return {
    guest_id: guestId,
    center_id: centerId,
    first_name: firstName,
    last_name: lastName,
    email: String(guest?.personal_info?.email ?? "").trim().toLowerCase(),
    date_of_birth: String(guest?.personal_info?.date_of_birth ?? "").trim(),
    phone:
      normPhone(guest?.personal_info?.mobile_phone?.number) ||
      normPhone(guest?.personal_info?.home_phone?.number) ||
      normPhone(guest?.personal_info?.work_phone?.number),
    display_name: [firstName, lastName].filter(Boolean).join(" ").trim() || "Profile",
  };
}

function dedupeProfiles(profiles: ClaimProfile[]) {
  const map = new Map<string, ClaimProfile>();
  for (const profile of profiles) {
    map.set(profile.guest_id, profile);
  }
  return Array.from(map.values());
}

function classifyProfiles(profiles: ClaimProfile[]) {
  if (profiles.length === 0) return { resolution: "none" as const };
  if (profiles.length === 1) return { resolution: "single" as const };

  const identityKeys = new Set(
    profiles.map((profile) => `${normName(profile.first_name)}|${normName(profile.last_name)}|${normDob(profile.date_of_birth)}`)
  );

  if (identityKeys.size === 1) {
    return { resolution: "support_required_duplicate" as const };
  }

  return { resolution: "multi_profile" as const };
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getOtpExpiresMinutes() {
  const value = Number(process.env.CLAIM_OTP_EXPIRES_MINUTES ?? "10");
  if (!Number.isFinite(value) || value <= 0) return 10;
  return Math.floor(value);
}

async function findProfilesByEmail(email: string) {
  const profiles: ClaimProfile[] = [];
  const defaultCenterId = (process.env.DEFAULT_CENTER_ID ?? "").trim() || CENTERS[0].id;
  const centers = [defaultCenterId, ...CENTERS.map((center) => center.id).filter((id) => id !== defaultCenterId)];

  for (const centerId of centers) {
    const response = await zenotiFetch<any>({
      method: "GET",
      path: "/v1/guests/search",
      query: {
        center_id: centerId,
        email,
        page: 1,
        size: 50,
      },
    });

    const guests = Array.isArray(response?.guests) ? response.guests : [];
    for (const guest of guests) {
      const profile = profileFromGuest(guest, centerId);
      if (profile) profiles.push(profile);
    }
  }

  return dedupeProfiles(profiles);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = normEmail(String(body?.email ?? ""));

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const db = await getMongoDb();
    const authCollection = db.collection(process.env.MONGODB_AUTH_COLLECTION ?? "auth_users");
    const existing = await authCollection.findOne({
      $or: [{ email }, { email_normalized: email }],
    });

    if (existing) {
      return NextResponse.json({ error: "An account already exists for this email. Please sign in." }, { status: 409 });
    }

    const profiles = await findProfilesByEmail(email);
    const classification = classifyProfiles(profiles);

    if (classification.resolution === "none") {
      return NextResponse.json({ error: "No Zenoti profile found for that email." }, { status: 404 });
    }

    if (classification.resolution === "support_required_duplicate") {
      return NextResponse.json(
        {
          error: "Duplicate profiles found. Please contact customer support to merge records.",
          resolution: "support_required_duplicate",
          profiles,
        },
        { status: 409 }
      );
    }

    const otpCode = generateOtpCode();
    const claimId = crypto.randomUUID();
    const now = new Date();
    const otpExpiresMinutes = getOtpExpiresMinutes();
    const expiresAt = new Date(Date.now() + otpExpiresMinutes * 60 * 1000);

    const claimCollection = db.collection<ClaimSessionDoc>(process.env.MONGODB_CLAIM_COLLECTION ?? "auth_claim_sessions");

    await claimCollection.updateOne(
      { claim_id: claimId },
      {
        $set: {
          claim_id: claimId,
          email,
          email_normalized: email,
          otp_hash: createPasswordHash(otpCode),
          expires_at: expiresAt,
          attempts: 0,
          profiles,
          resolution: classification.resolution,
          completed: false,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      { upsert: true }
    );

    const delivery = await sendOtpEmail({
      toEmail: email,
      otpCode,
    });

    const devMode = delivery.mode === "dev";

    return NextResponse.json({
      claim_id: claimId,
      resolution: classification.resolution,
      profiles,
      message: devMode
        ? "Verification code generated in dev mode."
        : "Verification code sent. Please check your email.",
      ...(devMode ? { otp_dev_code: otpCode } : {}),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Could not start claim" }, { status: 500 });
  }
}
