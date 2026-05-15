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

const notFound = (entity: string) => ({ error: `${entity} não encontrado` });

app.get("/api/test", (_req, res) => {
  return res.json({ status: "ok", message: "Backend funcionando" });
});

app.get("/api/usuarios", async (_req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(usuarios);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

app.post("/api/usuarios", async (req, res) => {
  try {
    const {
      cpf,
      nome,
      telefone,
      email,
      role,
      permissions,
      civil,
      endereco,
      profissao,
      matricula,
    } = req.body;
    const usuario = await prisma.usuario.create({
      data: {
        cpf,
        nome,
        telefone,
        email,
        role,
        permissions,
        civil,
        endereco,
        profissao,
        matricula,
      },
    });
    return res.status(201).json(usuario);
  } catch (error) {
    console.error("Erro ao cadastrar usuário:", error);
    return res.status(500).json({ error: "Erro ao cadastrar usuário" });
  }
});

app.put("/api/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const usuario = await prisma.usuario.update({
      where: { id },
      data: req.body,
    });
    return res.json(usuario);
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return res.status(404).json(notFound("Usuário"));
  }
});

app.delete("/api/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.usuario.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao remover usuário:", error);
    return res.status(404).json(notFound("Usuário"));
  }
});

app.get("/api/professores", async (_req, res) => {
  try {
    const professores = await prisma.professor.findMany({
      orderBy: { createdAt: "desc" },
      include: { usuario: true },
    });
    return res.json(professores);
  } catch (error) {
    console.error("Erro ao buscar professores:", error);
    return res.status(500).json({ error: "Erro ao buscar professores" });
  }
});

app.post("/api/professores", async (req, res) => {
  try {
    const { cpf, nome, telefone, email, permissions, profissao } = req.body;
    const professor = await prisma.professor.create({
      data: {
        usuario: {
          create: {
            cpf,
            nome,
            telefone,
            email,
            role: "PROFESSOR",
            permissions,
            profissao,
          },
        },
      },
      include: { usuario: true },
    });
    return res.status(201).json(professor);
  } catch (error) {
    console.error("Erro ao cadastrar professor:", error);
    return res.status(500).json({ error: "Erro ao cadastrar professor" });
  }
});

app.put("/api/professores/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const professor = await prisma.professor.update({
      where: { id },
      data: {
        usuario: {
          update: {
            ...req.body,
            role: "PROFESSOR",
          },
        },
      },
      include: { usuario: true },
    });
    return res.json(professor);
  } catch (error) {
    console.error("Erro ao atualizar professor:", error);
    return res.status(404).json(notFound("Professor"));
  }
});

app.delete("/api/professores/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.professor.delete({
      where: { id },
    });
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao remover professor:", error);
    return res.status(404).json(notFound("Professor"));
  }
});

app.get("/api/alunos", async (_req, res) => {
  try {
    const alunos = await prisma.aluno.findMany({
      orderBy: { createdAt: "desc" },
      include: { usuario: true },
    });
    return res.json(alunos);
  } catch (error) {
    console.error("Erro ao buscar alunos:", error);
    return res.status(500).json({ error: "Erro ao buscar alunos" });
  }
});

app.post("/api/alunos", async (req, res) => {
  try {
    const { cpf, nome, telefone, email, matricula, permissions } = req.body;
    const aluno = await prisma.aluno.create({
      data: {
        usuario: {
          create: {
            cpf,
            nome,
            telefone,
            email,
            role: "ALUNO",
            matricula,
            permissions,
          },
        },
      },
      include: { usuario: true },
    });
    return res.status(201).json(aluno);
  } catch (error) {
    console.error("Erro ao cadastrar aluno:", error);
    return res.status(500).json({ error: "Erro ao cadastrar aluno" });
  }
});

app.put("/api/alunos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const aluno = await prisma.aluno.update({
      where: { id },
      data: {
        usuario: {
          update: {
            ...req.body,
            role: "ALUNO",
          },
        },
      },
      include: { usuario: true },
    });
    return res.json(aluno);
  } catch (error) {
    console.error("Erro ao atualizar aluno:", error);
    return res.status(404).json(notFound("Aluno"));
  }
});

app.delete("/api/alunos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.aluno.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao remover aluno:", error);
    return res.status(404).json(notFound("Aluno"));
  }
});

app.get("/api/salas", async (_req, res) => {
  try {
    const salas = await prisma.sala.findMany({ orderBy: { nome: "asc" } });
    return res.json(salas);
  } catch (error) {
    console.error("Erro ao buscar salas:", error);
    return res.status(500).json({ error: "Erro ao buscar salas" });
  }
});

app.post("/api/salas", async (req, res) => {
  try {
    const { nome, capacidade, descricao } = req.body;
    const sala = await prisma.sala.create({
      data: { nome, capacidade: Number(capacidade), descricao },
    });
    return res.status(201).json(sala);
  } catch (error) {
    console.error("Erro ao cadastrar sala:", error);
    return res.status(500).json({ error: "Erro ao cadastrar sala" });
  }
});

app.put("/api/salas/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const sala = await prisma.sala.update({
      where: { id },
      data: {
        nome: req.body.nome,
        capacidade: Number(req.body.capacidade),
        descricao: req.body.descricao,
      },
    });
    return res.json(sala);
  } catch (error) {
    console.error("Erro ao atualizar sala:", error);
    return res.status(404).json(notFound("Sala"));
  }
});

app.delete("/api/salas/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.sala.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao remover sala:", error);
    return res.status(404).json(notFound("Sala"));
  }
});

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
