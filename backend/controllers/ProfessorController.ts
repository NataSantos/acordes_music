import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";
import bcrypt from "bcryptjs";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/roles.js";
import { professorCreateSchema } from "../utils/validationProfessor.js";
import { usuarioSchema } from "../utils/validation.js";
import { extrairPrimeiroErro } from "../utils/validation.js";
import { ZodError } from "zod";

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

  router.post("/", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const data = professorCreateSchema.parse(req.body);
      const existente = await prisma.usuario.findFirst({
        where: { OR: [{ cpf: data.cpf }, { email: data.email }] },
      });
      if (existente) {
        const motivo = existente.cpf === data.cpf ? "CPF" : "email";
        return res.status(409).json({ error: `Já existe um usuário cadastrado com este ${motivo}` });
      }

      const cpfDigits = data.cpf.replace(/\D/g, "");
      const senhaHash = await bcrypt.hash(cpfDigits.slice(0, 6), 10);

      const professor = await prisma.professor.create({
        data: {
          civil: data.civil ?? null,
          endereco: data.endereco ?? null,
          profissao: data.profissao ?? null,
          usuario: {
            create: {
              cpf: data.cpf,
              nome: data.nome,
              telefone: data.telefone,
              email: data.email,
              senha: senhaHash,
              role: "PROFESSOR",
            },
          },
        },
        include: { usuario: true },
      });
      return res.status(201).json(professor);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: extrairPrimeiroErro(error) });
      }
      console.error("Erro ao cadastrar professor:", error);
      return res.status(500).json({ error: "Erro ao cadastrar professor" });
    }
  });

  router.put("/:id", authMiddleware, requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    try {
      const data = professorCreateSchema.partial().parse(req.body);
      const professor = await prisma.professor.findUnique({
        where: { id },
        include: { usuario: true },
      });
      if (!professor) return res.status(404).json(notFound());

      const cpf = data.cpf ?? professor.usuario.cpf;
      const email = data.email ?? professor.usuario.email;
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
          ...(data.civil !== undefined && { civil: data.civil }),
          ...(data.endereco !== undefined && { endereco: data.endereco }),
          ...(data.profissao !== undefined && { profissao: data.profissao }),
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
      console.error("Erro ao atualizar professor:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", authMiddleware, requireAdmin, async (req, res) => {
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
