import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";
import bcrypt from "bcryptjs";
import { authMiddleware } from "../middleware/auth.js";

export default function ProfessorController(prisma: PrismaClient): Router {
  const router = Router();

  const notFound = () => ({ error: "Professor não encontrado" });

  router.get("/", authMiddleware, async (_req, res) => {
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

  router.post("/", authMiddleware, async (req, res) => {
    try {
      const { cpf, nome, telefone, email, permissions, civil, endereco, profissao } = req.body;
      const existente = await prisma.usuario.findFirst({
        where: { OR: [{ cpf }, { email }] },
      });
      if (existente) {
        const motivo = existente.cpf === cpf ? "CPF" : "email";
        return res.status(409).json({ error: `Já existe um usuário cadastrado com este ${motivo}` });
      }
      const senhaHash = await bcrypt.hash("1234", 10);
      const professor = await prisma.professor.create({
        data: {
          civil,
          endereco,
          profissao,
          usuario: {
            create: { cpf, nome, telefone, email, senha: senhaHash, role: "PROFESSOR", permissions },
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

  router.put("/:id", authMiddleware, async (req, res) => {
    const id = req.params.id as string;
    try {
      const { cpf, nome, telefone, email, permissions, civil, endereco, profissao } = req.body;
      const professor = await prisma.professor.findUnique({
        where: { id },
        include: { usuario: true },
      });
      if (!professor) return res.status(404).json(notFound());
      const existente = await prisma.usuario.findFirst({
        where: {
          OR: [{ cpf }, { email }],
          NOT: { id: professor.usuarioId },
        },
      });
      if (existente) {
        const motivo = existente.cpf === cpf ? "CPF" : "email";
        return res.status(409).json({ error: `Já existe outro usuário cadastrado com este ${motivo}` });
      }
      const atualizado = await prisma.professor.update({
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
      return res.json(atualizado);
    } catch (error) {
      console.error("Erro ao atualizar professor:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", authMiddleware, async (req, res) => {
    const id = req.params.id as string;
    try {
      const professor = await prisma.professor.findUnique({
        where: { id },
        include: { usuario: true },
      });
      if (!professor) return res.status(404).json(notFound());

      await prisma.agendamento.deleteMany({ where: { professorId: id } });
      await prisma.professor.delete({ where: { id } });
      await prisma.usuario.delete({ where: { id: professor.usuarioId } });

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao remover professor:", error);
      return res.status(404).json(notFound());
    }
  });

  return router;
}
