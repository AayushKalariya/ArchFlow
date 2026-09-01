import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../src/prisma/contract.d";
import contractJson from "../src/prisma/contract.json";

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof postgres<Contract>>;
};

function createDb() {
  return postgres<Contract>({
    contractJson,
    url: process.env.DATABASE_URL!,
  });
}

export const prisma = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = prisma;
}
