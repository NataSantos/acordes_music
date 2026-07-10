import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";
import bcrypt from "bcryptjs";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin, requireAdminOrProfessor } from "../middleware/roles.js";
import { alunoCreateSchema } from "../utils/validationAluno.js";
import { extrairPrimeiroErro } from "../utils/validation.js";
import { ZodError } from "zod";

export default function AlunoController(prisma: PrismaClient): Router {
  const router = Router();

  const notFound = () => ({ error: "Aluno não encontrado" });

  router.get("/", authMiddleware, requireAdminOrProfessor, async (_req, res) => {
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

  router.post("/", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const data = alunoCreateSchema.parse(req.body);
      const existente = await prisma.usuario.findFirst({
        where: { OR: [{ cpf: data.cpf }, { email: data.email }] },
      });
      if (existente) {
        const motivo = existente.cpf === data.cpf ? "CPF" : "email";
        return res.status(409).json({ error: `Já existe um usuário cadastrado com este ${motivo}` });
      }

      const cpfDigits = data.cpf.replace(/\D/g, "");
      const senhaHash = await bcrypt.hash(cpfDigits.slice(0, 6), 10);

      const aluno = await prisma.aluno.create({
        data: {
          matricula: data.matricula ?? null,
          redeSocial: data.redeSocial || null,
          diaPagamento: data.diaPagamento ? Number(data.diaPagamento) : null,
          dataInicioContrato: data.dataInicioContrato ? new Date(data.dataInicioContrato) : null,
          dataFimContrato: data.dataFimContrato ? new Date(data.dataFimContrato) : null,
          usuario: {
            create: {
              cpf: data.cpf,
              nome: data.nome,
              telefone: data.telefone,
              email: data.email,
              senha: senhaHash,
              role: "ALUNO",
            },
          },
        },
        include: { usuario: true },
      });
      return res.status(201).json(aluno);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: extrairPrimeiroErro(error) });
      }
      console.error("Erro ao cadastrar aluno:", error);
      return res.status(500).json({ error: "Erro ao cadastrar aluno" });
    }
  });

  router.put("/:id", authMiddleware, requireAdminOrProfessor, async (req, res) => {
    const id = req.params.id as string;
    try {
      const data = alunoCreateSchema.partial().parse(req.body);
      const aluno = await prisma.aluno.findUnique({
        where: { id },
        include: { usuario: true },
      });
      if (!aluno) return res.status(404).json(notFound());

      const cpf = data.cpf ?? aluno.usuario.cpf;
      const email = data.email ?? aluno.usuario.email;
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
          ...(data.matricula !== undefined && { matricula: data.matricula }),
          ...(data.redeSocial !== undefined && { redeSocial: data.redeSocial }),
          ...(data.diaPagamento !== undefined && { diaPagamento: Number(data.diaPagamento) }),
          ...(data.dataInicioContrato !== undefined && { dataInicioContrato: new Date(data.dataInicioContrato) }),
          ...(data.dataFimContrato !== undefined && { dataFimContrato: new Date(data.dataFimContrato) }),
          usuario: {
            update: {
              ...(data.cpf !== undefined && { cpf: data.cpf }),
              ...(data.nome !== undefined && { nome: data.nome }),
              ...(data.telefone !== undefined && { telefone: data.telefone }),
              ...(data.email !== undefined && { email: data.email }),
            },
          },
        },
        include: { usuario: true },
      });
      return res.json(atualizado);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: extrairPrimeiroErro(error) });
      }
      console.error("Erro ao atualizar aluno:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", authMiddleware, requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    try {
      const aluno = await prisma.aluno.findUnique({
        where: { id },
        include: { usuario: true },
      });
      if (!aluno) return res.status(404).json(notFound());

      await prisma.agendamento.deleteMany({ where: { alunoId: id } });
      await prisma.aluno.delete({ where: { id } });
      await prisma.usuario.delete({ where: { id: aluno.usuarioId } });

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao remover aluno:", error);
      return res.status(404).json(notFound());
    }
  });

  return router;
}
