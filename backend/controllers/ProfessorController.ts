import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";

export default function ProfessorController(prisma: PrismaClient): Router {
  const router = Router();

  const notFound = () => ({ error: "Professor não encontrado" });

  router.get("/", async (_req, res) => {
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

  router.post("/", async (req, res) => {
    try {
      const { cpf, nome, telefone, email, permissions, civil, endereco, profissao } = req.body;
      const professor = await prisma.professor.create({
        data: {
          civil,
          endereco,
          profissao,
          usuario: {
            create: { cpf, nome, telefone, email, role: "PROFESSOR", permissions },
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

  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const { cpf, nome, telefone, email, permissions, civil, endereco, profissao } = req.body;
      const professor = await prisma.professor.update({
        where: { id },
        data: {
          civil,
          endereco,
          profissao,
          usuario: {
            update: { cpf, nome, telefone, email, permissions, role: "PROFESSOR" },
          },
        },
        include: { usuario: true },
      });
      return res.json(professor);
    } catch (error) {
      console.error("Erro ao atualizar professor:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await prisma.professor.delete({ where: { id } });
      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao remover professor:", error);
      return res.status(404).json(notFound());
    }
  });

  return router;
}
