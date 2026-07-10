import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";
import bcrypt from "bcryptjs";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/roles.js";
import { usuarioSchema, extrairPrimeiroErro } from "../utils/validation.js";
import { ZodError } from "zod";

export default function UsuarioController(prisma: PrismaClient): Router {
  const router = Router();

  const notFound = () => ({ error: "Usuário não encontrado" });

  router.get("/", authMiddleware, requireAdmin, async (_req, res) => {
    try {
      const usuarios = await prisma.usuario.findMany({
        include: { professor: true, aluno: true },
      });
      return res.json(usuarios);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      return res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  router.post("/", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const data = usuarioSchema.parse(req.body);
      const existente = await prisma.usuario.findFirst({
        where: { OR: [{ cpf: data.cpf }, { email: data.email }] },
      });
      if (existente) {
        const motivo = existente.cpf === data.cpf ? "CPF" : "email";
        return res.status(409).json({ error: `Já existe um usuário cadastrado com este ${motivo}` });
      }

      const cpfDigits = data.cpf.replace(/\D/g, "");
      const senhaPadrao = cpfDigits.slice(0, 6);
      const senhaHash = await bcrypt.hash(senhaPadrao, 10);

      const usuario = await prisma.usuario.create({
        data: {
          cpf: data.cpf,
          nome: data.nome,
          telefone: data.telefone,
          email: data.email,
          senha: senhaHash,
          role: data.role,
          permissions: data.permissions ?? null,
        },
      });
      return res.status(201).json(usuario);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: extrairPrimeiroErro(error) });
      }
      console.error("Erro ao cadastrar usuário:", error);
      return res.status(500).json({ error: "Erro ao cadastrar usuário" });
    }
  });

  router.put("/:id", authMiddleware, requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    try {
      const data = usuarioSchema.partial().parse(req.body);
      const usuario = await prisma.usuario.update({
        where: { id },
        data: {
          ...(data.cpf !== undefined && { cpf: data.cpf }),
          ...(data.nome !== undefined && { nome: data.nome }),
          ...(data.telefone !== undefined && { telefone: data.telefone }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.role !== undefined && { role: data.role }),
          ...(data.permissions !== undefined && { permissions: data.permissions }),
        },
      });
      return res.json(usuario);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: extrairPrimeiroErro(error) });
      }
      console.error("Erro ao atualizar usuário:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", authMiddleware, requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    try {
      const usuario = await prisma.usuario.findUnique({ where: { id } });
      if (!usuario) return res.status(404).json(notFound());
      const professor = await prisma.professor.findUnique({ where: { usuarioId: id } });
      const aluno = await prisma.aluno.findUnique({ where: { usuarioId: id } });
      if (professor || aluno) {
        return res.status(409).json({ error: "Usuário possui perfil de professor ou aluno. Remova-o através da seção de Professores ou Alunos." });
      }
      await prisma.usuario.delete({ where: { id } });
      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao remover usuário:", error);
      return res.status(500).json({ error: "Erro ao remover usuário" });
    }
  });

  return router;
}
