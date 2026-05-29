import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";
import bcrypt from "bcryptjs";

export default function UsuarioController(prisma: PrismaClient): Router {
  const router = Router();

  const notFound = () => ({ error: "Usuário não encontrado" });

  router.get("/", async (_req, res) => {
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

  router.post("/", async (req, res) => {
    try {
      const { cpf, nome, telefone, email, role, permissions } = req.body;
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

  router.put("/:id", async (req, res) => {
    const { id } = req.params;
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

  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await prisma.usuario.delete({ where: { id } });
      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao remover usuário:", error);
      return res.status(404).json(notFound());
    }
  });

  return router;
}
