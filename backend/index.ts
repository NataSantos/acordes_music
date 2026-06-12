import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "./generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import SalaController from "./controllers/SalaController.js";
import UsuarioController from "./controllers/UsuarioController.js";
import ProfessorController from "./controllers/ProfessorController.js";
import AlunoController from "./controllers/AlunoController.js";
import AgendamentoController from "./controllers/AgendamentoController.js";
import AuthController from "./controllers/AuthController.js";
import GanhosController from "./controllers/GanhosController.js";
import UploadController from "./controllers/UploadController.js";

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

app.use("/api/salas", SalaController(prisma));
app.use("/api/usuarios", UsuarioController(prisma));
app.use("/api/professores", ProfessorController(prisma));
app.use("/api/alunos", AlunoController(prisma));
app.use("/api/agendamentos", AgendamentoController(prisma));
app.use("/api/auth", AuthController(prisma));
app.use("/api/ganhos", GanhosController(prisma));
app.use("/api/upload", UploadController(prisma));

async function main() {
  try {
    app.listen(port, () => {
      console.log(`Backend rodando em http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Erro ao inicializar o backend:", error);
    process.exit(1);
  }
}

main();
