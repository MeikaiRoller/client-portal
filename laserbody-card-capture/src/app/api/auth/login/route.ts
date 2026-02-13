import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";
import { verifyPassword } from "@/lib/password";
import { zenotiFetch } from "@/lib/zenoti";
import { CENTERS } from "@/lib/centers";

export const runtime = "nodejs";

type LinkedProfileDoc = {
  zenoti_guest_id: string;
  zenoti_center_id?: string;
  relationship?: string;
};

type AuthUserDoc = {
  email: string;
  email_normalized?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  password_hash: string;
  zenoti_guest_id?: string;
  zenoti_center_id?: string;
  linked_profiles?: LinkedProfileDoc[];
};

type ResolvedProfile = {
  guest_id: string;
  center_id: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  display_name: string;
  relationship?: string;
};

function normEmail(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function normPhone(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function normName(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function normDob(value?: string) {
  return (value ?? "").trim();
}

function getDefaultCenterId() {
  const env = (process.env.DEFAULT_CENTER_ID ?? "").trim();
  if (env) return env;

  const brampton = CENTERS.find((c) => c.code === "BR");
  return brampton?.id ?? CENTERS[0].id;
}

function profileFromGuest(guest: any, centerId: string, relationship?: string): ResolvedProfile | null {
  const guestId = String(guest?.id ?? "").trim();
  if (!guestId) return null;

  const first_name = String(guest?.personal_info?.first_name ?? "").trim();
  const last_name = String(guest?.personal_info?.last_name ?? "").trim();

  return {
    guest_id: guestId,
    center_id: centerId,
    first_name,
    last_name,
    email: String(guest?.personal_info?.email ?? "").trim().toLowerCase(),
    date_of_birth: String(guest?.personal_info?.date_of_birth ?? "").trim(),
    display_name: [first_name, last_name].filter(Boolean).join(" ").trim() || "Profile",
    ...(relationship ? { relationship } : {}),
  };
}

function dedupeProfiles(profiles: ResolvedProfile[]) {
  const map = new Map<string, ResolvedProfile>();
  for (const profile of profiles) {
    map.set(profile.guest_id, profile);
  }
  return Array.from(map.values());
}

function classifyProfiles(profiles: ResolvedProfile[]) {
  if (profiles.length === 0) {
    return { resolution: "none" as const };
  }

  if (profiles.length === 1) {
    return { resolution: "single" as const, profile: profiles[0] };
  }

  const identityKeys = new Set(
    profiles.map((profile) => {
      const first = normName(profile.first_name);
      const last = normName(profile.last_name);
      const dob = normDob(profile.date_of_birth);
      return `${first}|${last}|${dob}`;
    })
  );

  if (identityKeys.size === 1) {
    return {
      resolution: "support_required_duplicate" as const,
      profiles,
    };
  }

  return {
    resolution: "multi_profile" as const,
    profiles,
  };
}

async function findZenotiProfiles(user: AuthUserDoc): Promise<ResolvedProfile[]> {
  const defaultCenterId = getDefaultCenterId();

  const explicitLinks: LinkedProfileDoc[] = [];

  if (Array.isArray(user.linked_profiles)) {
    explicitLinks.push(...user.linked_profiles.filter((p) => p?.zenoti_guest_id));
  }

  if (user.zenoti_guest_id) {
    explicitLinks.push({
      zenoti_guest_id: user.zenoti_guest_id,
      zenoti_center_id: user.zenoti_center_id,
    });
  }

  if (explicitLinks.length > 0) {
    const resolved: ResolvedProfile[] = [];

    for (const linked of explicitLinks) {
      try {
        const centerId = linked.zenoti_center_id ?? defaultCenterId;
        const detail = await zenotiFetch<any>({
          method: "GET",
          path: `/v1/guests/${linked.zenoti_guest_id}`,
          query: {
            center_id: centerId,
          },
        });

        const profile = profileFromGuest(detail, centerId, linked.relationship);
        if (profile) {
          resolved.push(profile);
        }
      } catch {
        continue;
      }
    }

    return dedupeProfiles(resolved);
  }

  const email = normEmail(user.email);
  const phone = normPhone(user.phone);
  const firstName = normName(user.first_name);
  const lastName = normName(user.last_name);

  if (!email && !phone && !(firstName && lastName)) {
    return [];
  }

  const centers = [defaultCenterId, ...CENTERS.map((c) => c.id).filter((id) => id !== defaultCenterId)];
  const foundProfiles: ResolvedProfile[] = [];

  for (const center_id of centers) {
    const response = await zenotiFetch<any>({
      method: "GET",
      path: "/v1/guests/search",
      query: {
        center_id,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(firstName ? { first_name: user.first_name } : {}),
        ...(lastName ? { last_name: user.last_name } : {}),
        page: 1,
        size: 50,
      },
    });

    const guests = Array.isArray(response?.guests) ? response.guests : [];

    for (const guest of guests) {
      const profile = profileFromGuest(guest, center_id);
      if (!profile) continue;

      const guestEmail = normEmail(profile.email);
      const guestPhone =
        normPhone(guest?.personal_info?.mobile_phone?.number) ||
        normPhone(guest?.personal_info?.home_phone?.number) ||
        normPhone(guest?.personal_info?.work_phone?.number);
      const guestFirst = normName(profile.first_name);
      const guestLast = normName(profile.last_name);

      const emailMatch = email && guestEmail && email === guestEmail;
      const phoneMatch = phone && guestPhone && phone === guestPhone;
      const nameMatch = firstName && lastName && guestFirst === firstName && guestLast === lastName;

      if (emailMatch || phoneMatch || nameMatch) {
        foundProfiles.push(profile);
      }
    }
  }

  return dedupeProfiles(foundProfiles);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "email and password are required" }, { status: 400 });
    }

    const db = await getMongoDb();
    const users = db.collection<AuthUserDoc>(process.env.MONGODB_AUTH_COLLECTION ?? "auth_users");

    const emailLower = normEmail(email);
    const user = await users.findOne({
      $or: [{ email: emailLower }, { email_normalized: emailLower }],
    });

    if (!user?.password_hash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const profiles = await findZenotiProfiles(user);
    const classification = classifyProfiles(profiles);

    const zenotiPayload =
      classification.resolution === "single"
        ? {
            found: true,
            resolution: "single" as const,
            profile_count: 1,
            guest_id: classification.profile.guest_id,
            center_id: classification.profile.center_id,
            guest: {
              first_name: classification.profile.first_name,
              last_name: classification.profile.last_name,
              email: classification.profile.email,
            },
            profiles,
          }
        : classification.resolution === "multi_profile"
        ? {
            found: true,
            resolution: "multi_profile" as const,
            profile_count: profiles.length,
            profiles,
          }
        : classification.resolution === "support_required_duplicate"
        ? {
            found: true,
            resolution: "support_required_duplicate" as const,
            profile_count: profiles.length,
            profiles,
          }
        : {
            found: false,
            resolution: "none" as const,
            profile_count: 0,
            profiles: [],
          };

    return NextResponse.json({
      authenticated: true,
      user: {
        email: user.email,
        first_name: user.first_name ?? "",
        last_name: user.last_name ?? "",
      },
      zenoti: zenotiPayload,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Login failed" }, { status: 500 });
  }
}
