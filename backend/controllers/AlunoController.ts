import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";
import bcrypt from "bcryptjs";
import { authMiddleware } from "../middleware/auth.js";

export default function AlunoController(prisma: PrismaClient): Router {
  const router = Router();

  const notFound = () => ({ error: "Aluno não encontrado" });

  router.get("/", authMiddleware, async (_req, res) => {
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

  router.post("/", authMiddleware, async (req, res) => {
    try {
      const { cpf, nome, telefone, email, permissions, matricula } = req.body;
      const existente = await prisma.usuario.findFirst({
        where: { OR: [{ cpf }, { email }] },
      });
      if (existente) {
        const motivo = existente.cpf === cpf ? "CPF" : "email";
        return res.status(409).json({ error: `Já existe um usuário cadastrado com este ${motivo}` });
      }
      const senhaHash = await bcrypt.hash("1234", 10);
      const aluno = await prisma.aluno.create({
        data: {
          matricula,
          usuario: {
            create: { cpf, nome, telefone, email, senha: senhaHash, role: "ALUNO", permissions },
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

  router.put("/:id", authMiddleware, async (req, res) => {
    const id = req.params.id as string;
    try {
      const { cpf, nome, telefone, email, permissions, matricula } = req.body;
      const aluno = await prisma.aluno.findUnique({
        where: { id },
        include: { usuario: true },
      });
      if (!aluno) return res.status(404).json(notFound());
      const existente = await prisma.usuario.findFirst({
        where: {
          OR: [{ cpf }, { email }],
          NOT: { id: aluno.usuarioId },
        },
      });
      if (existente) {
        const motivo = existente.cpf === cpf ? "CPF" : "email";
        return res.status(409).json({ error: `Já existe outro usuário cadastrado com este ${motivo}` });
      }
      const atualizado = await prisma.aluno.update({
        where: { id },
        data: {
          matricula,
          usuario: {
            update: { cpf, nome, telefone, email, permissions, role: "ALUNO" },
          },
        },
        include: { usuario: true },
      });
      return res.json(atualizado);
    } catch (error) {
      console.error("Erro ao atualizar aluno:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", authMiddleware, async (req, res) => {
    const id = req.params.id as string;
    try {
      const agendamentos = await prisma.agendamento.count({ where: { alunoId: id } });
      if (agendamentos > 0) {
        return res.status(409).json({ error: "Aluno possui agendamentos vinculados. Remova-os antes de excluir." });
      }
      await prisma.aluno.delete({ where: { id } });
      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao remover aluno:", error);
      return res.status(404).json(notFound());
    }
  });

  return router;
}
