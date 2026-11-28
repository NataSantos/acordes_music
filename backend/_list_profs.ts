import "dotenv/config";
import { PrismaClient } from "./generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  const p = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./dev.db",
    }),
  });
  const u = await p.usuario.findMany({ select: { nome: true, email: true, role: true } });
  console.log(JSON.stringify(u, null, 2));
  await p.$disconnect();
}
main();
