import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";
import { createPasswordHash, verifyPassword } from "@/lib/password";

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
  completed?: boolean;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const claimId = String(body?.claim_id ?? "").trim();
    const otpCode = String(body?.otp_code ?? "").trim();
    const password = String(body?.password ?? "");
    const selectedGuestId = String(body?.selected_guest_id ?? "").trim();

    if (!claimId || !otpCode || !password) {
      return NextResponse.json({ error: "claim_id, otp_code, and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const db = await getMongoDb();
    const claimCollection = db.collection<ClaimSessionDoc>(process.env.MONGODB_CLAIM_COLLECTION ?? "auth_claim_sessions");
    const claim = await claimCollection.findOne({ claim_id: claimId });

    if (!claim || claim.completed) {
      return NextResponse.json({ error: "Claim session not found or already used" }, { status: 404 });
    }

    if (new Date(claim.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Verification code expired. Please restart claim." }, { status: 410 });
    }

    if ((claim.attempts ?? 0) >= 5) {
      return NextResponse.json({ error: "Too many attempts. Please restart claim." }, { status: 429 });
    }

    const otpValid = verifyPassword(otpCode, claim.otp_hash);
    if (!otpValid) {
      await claimCollection.updateOne({ claim_id: claimId }, { $inc: { attempts: 1 }, $set: { updated_at: new Date() } });
      return NextResponse.json({ error: "Invalid verification code" }, { status: 401 });
    }

    const selected =
      claim.profiles.find((profile) => profile.guest_id === selectedGuestId) ??
      claim.profiles[0] ??
      null;

    if (!selected) {
      return NextResponse.json({ error: "No claimable profile found" }, { status: 404 });
    }

    const linked_profiles = claim.profiles.map((profile) => ({
      zenoti_guest_id: profile.guest_id,
      zenoti_center_id: profile.center_id,
    }));

    const now = new Date();
    const users = db.collection(process.env.MONGODB_AUTH_COLLECTION ?? "auth_users");

    await users.updateOne(
      { email_normalized: claim.email_normalized },
      {
        $set: {
          email: claim.email,
          email_normalized: claim.email_normalized,
          password_hash: createPasswordHash(password),
          first_name: selected.first_name,
          last_name: selected.last_name,
          phone: selected.phone,
          zenoti_guest_id: selected.guest_id,
          zenoti_center_id: selected.center_id,
          linked_profiles,
          migration_source: "zenoti_claim",
          migrated_at: now,
          is_active: true,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      { upsert: true }
    );

    await claimCollection.updateOne(
      { claim_id: claimId },
      {
        $set: {
          completed: true,
          completed_at: now,
          updated_at: now,
        },
      }
    );

    return NextResponse.json({
      created: true,
      user: {
        email: claim.email,
      },
      zenoti: {
        resolution: linked_profiles.length > 1 ? "multi_profile" : "single",
        guest_id: selected.guest_id,
        center_id: selected.center_id,
        profiles: claim.profiles,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Could not complete claim" }, { status: 500 });
  }
}
