import { randomBytes, scryptSync } from "crypto";
import { MongoClient } from "mongodb";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "";
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function normalizeEmail(value = "") {
  return value.trim().toLowerCase();
}

function normalizePhone(value = "") {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function createPasswordHash(plainPassword) {
  const n = 16384;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plainPassword, salt, 64, { N: n, r, p });
  return `scrypt$${n}$${r}$${p}$${salt}$${derived.toString("hex")}`;
}

function required(name, value) {
  if (!value) {
    throw new Error(`Missing required argument: --${name}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = normalizeEmail(args.email);
  const password = args.password ?? "";
  const firstName = (args.first ?? "").trim();
  const lastName = (args.last ?? "").trim();
  const phone = normalizePhone(args.phone ?? "");
  const zenotiGuestId = (args.zenotiGuestId ?? "").trim();
  const zenotiCenterId = (args.zenotiCenterId ?? "").trim();
  const relationship = (args.relationship ?? "").trim();

  required("email", email);
  required("password", password);

  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  const collectionName = process.env.MONGODB_AUTH_COLLECTION || "auth_users";

  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI in environment.");
  }
  if (!dbName) {
    throw new Error("Missing MONGODB_DB_NAME in environment.");
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const collection = client.db(dbName).collection(collectionName);

    await collection.createIndex({ email_normalized: 1 }, { unique: true });

    const now = new Date();
    const passwordHash = createPasswordHash(password);

    const update = {
      $set: {
        email,
        email_normalized: email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        phone,
        is_active: true,
        updated_at: now,
        ...(zenotiGuestId ? { zenoti_guest_id: zenotiGuestId } : {}),
        ...(zenotiCenterId ? { zenoti_center_id: zenotiCenterId } : {}),
        ...(zenotiGuestId
          ? {
              linked_profiles: [
                {
                  zenoti_guest_id: zenotiGuestId,
                  ...(zenotiCenterId ? { zenoti_center_id: zenotiCenterId } : {}),
                  ...(relationship ? { relationship } : {}),
                },
              ],
            }
          : {}),
      },
      $setOnInsert: {
        created_at: now,
      },
    };

    await collection.updateOne({ email_normalized: email }, update, { upsert: true });

    console.log("Auth user upserted successfully.");
    console.log(JSON.stringify({ email, collection: collectionName }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
