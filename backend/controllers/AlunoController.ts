import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";

export default function AlunoController(prisma: PrismaClient): Router {
  const router = Router();

  const notFound = () => ({ error: "Aluno não encontrado" });

  router.get("/", async (_req, res) => {
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

  router.post("/", async (req, res) => {
    try {
      const { cpf, nome, telefone, email, permissions, matricula } = req.body;
      const aluno = await prisma.aluno.create({
        data: {
          matricula,
          usuario: {
            create: { cpf, nome, telefone, email, role: "ALUNO", permissions },
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

  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const { cpf, nome, telefone, email, permissions, matricula } = req.body;
      const aluno = await prisma.aluno.update({
        where: { id },
        data: {
          matricula,
          usuario: {
            update: { cpf, nome, telefone, email, permissions, role: "ALUNO" },
          },
        },
        include: { usuario: true },
      });
      return res.json(aluno);
    } catch (error) {
      console.error("Erro ao atualizar aluno:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await prisma.aluno.delete({ where: { id } });
      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao remover aluno:", error);
      return res.status(404).json(notFound());
    }
  });

  return router;
}
