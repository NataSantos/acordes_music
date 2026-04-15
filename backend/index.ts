import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "./generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const app = express();
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

app.get("/api/test", (_req, res) => {
  return res.json({ status: "ok", message: "Backend funcionando" });
});

app.get("/api/professores", async (_req, res) => {
  try {
    const professores = await prisma.professor.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(professores);
  } catch (error) {
    console.error("Erro ao buscar professores:", error);
    return res.status(500).json({ error: "Erro ao buscar professores" });
  }
});

async function main() {
  try {
    const total = await prisma.professor.count();
    if (total === 0) {
      await prisma.professor.createMany({
        data: [
          {
            nome: "Ana Silva",
            email: "ana.silva@example.com",
            telefone: "(11) 98765-4321",
          },
          {
            nome: "Carlos Pereira",
            email: "carlos.pereira@example.com",
            telefone: "(21) 99876-5432",
          },
          {
            nome: "Beatriz Souza",
            email: "beatriz.souza@example.com",
            telefone: "(31) 91234-5678",
          },
        ],
      });
      console.log("Dados de exemplo de professores gerados.");
    }
    app.listen(port, () => {
      console.log(`Backend rodando em http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Erro ao inicializar o backend:", error);
    process.exit(1);
  }
}

main();
