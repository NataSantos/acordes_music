import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";
import bcrypt from "bcryptjs";
import { authMiddleware } from "../middleware/auth.js";

export default function UsuarioController(prisma: PrismaClient): Router {
  const router = Router();

  const notFound = () => ({ error: "Usuário não encontrado" });

  router.get("/", authMiddleware, async (_req, res) => {
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

  router.post("/", authMiddleware, async (req, res) => {
    try {
      const { cpf, nome, telefone, email, role, permissions } = req.body;
      const existente = await prisma.usuario.findFirst({
        where: { OR: [{ cpf }, { email }] },
      });
      if (existente) {
        const motivo = existente.cpf === cpf ? "CPF" : "email";
        return res.status(409).json({ error: `Já existe um usuário cadastrado com este ${motivo}` });
      }
      const senhaHash = await bcrypt.hash("1234", 10);
      const usuario = await prisma.usuario.create({
        data: { cpf, nome, telefone, email, senha: senhaHash, role, permissions },
      });
      return res.status(201).json(usuario);
    } catch (error) {
      console.error("Erro ao cadastrar usuário:", error);
      return res.status(500).json({ error: "Erro ao cadastrar usuário" });
    }
  });

  router.put("/:id", authMiddleware, async (req, res) => {
    const id = req.params.id as string;
    try {
      const { cpf, nome, telefone, email, role, permissions } = req.body;
      const usuario = await prisma.usuario.update({
        where: { id },
        data: { cpf, nome, telefone, email, role, permissions },
      });
      return res.json(usuario);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", authMiddleware, async (req, res) => {
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
