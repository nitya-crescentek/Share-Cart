import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Reused across warm serverless invocations. Without this, every invocation opens a new
// pool against Supabase and exhausts connections under load -- the DATABASE_URL is
// expected to carry `?pgbouncer=true&connection_limit=1` for the same reason.
const prisma = global.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

export default prisma;
