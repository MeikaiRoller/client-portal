import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;

if (!uri) {
  throw new Error("Missing MONGODB_URI in environment.");
}

if (!dbName) {
  throw new Error("Missing MONGODB_DB_NAME in environment.");
}

type GlobalMongoCache = {
  clientPromise?: Promise<MongoClient>;
};

const globalForMongo = globalThis as typeof globalThis & {
  __mongo?: GlobalMongoCache;
};

if (!globalForMongo.__mongo) {
  globalForMongo.__mongo = {};
}

const mongoCache = globalForMongo.__mongo;

if (!mongoCache.clientPromise) {
  const client = new MongoClient(uri);
  mongoCache.clientPromise = client.connect();
}

export async function getMongoDb(): Promise<Db> {
  const client = await mongoCache.clientPromise!;
  return client.db(dbName);
}
