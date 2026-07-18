import { MongoClient, Db, Collection, Document } from "mongodb";

/**
 * MongoDB connection helper.
 *
 * Uses a cached client promise so we reuse a single connection pool across
 * hot-reloads in dev and across route-handler invocations in production.
 * The client is created lazily so the app can boot even before MONGODB_URI
 * is filled in `.env.local` (it only throws when the DB is actually used).
 */

const DEFAULT_DB = "janman_survey";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local and restart the dev server."
    );
  }

  const options = { serverSelectionTimeoutMS: 15000 };

  if (process.env.NODE_ENV !== "production") {
    // Reuse the promise across HMR reloads in development.
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri, options)
        .connect()
        .catch((err) => {
          // Don't cache a failed connection — allow the next call to retry.
          global._mongoClientPromise = undefined;
          throw err;
        });
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(uri, options)
      .connect()
      .catch((err) => {
        clientPromise = undefined;
        throw err;
      });
  }
  return clientPromise;
}

export async function getClient(): Promise<MongoClient> {
  return connect();
}

export async function getDb(): Promise<Db> {
  const client = await connect();
  return client.db(process.env.MONGODB_DB || DEFAULT_DB);
}

export async function getCollection<T extends Document = Document>(
  name: string
): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}
