import { Router } from "express";
import type { Request, Response } from "express";
import { PrismaClient } from "../generated/client.js";
import bcrypt from "bcryptjs";
import { gerarToken, authMiddleware } from "../middleware/auth.js";

export default function AuthController(prisma: PrismaClient) {
  const router = Router();

  router.post("/login", async (req: Request, res: Response) => {
    try {
      const { email, senha } = req.body;
      if (!email || !senha) {
        return res.status(400).json({ error: "Email e senha são obrigatórios" });
      }

      const usuario = await prisma.usuario.findUnique({ where: { email } });
      if (!usuario) {
        return res.status(401).json({ error: "Email ou senha inválidos" });
      }

      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      if (!senhaValida) {
        return res.status(401).json({ error: "Email ou senha inválidos" });
      }

      const professor = await prisma.professor.findUnique({ where: { usuarioId: usuario.id } });

      const token = gerarToken({
        id: professor?.id ?? usuario.id,
        role: usuario.role,
        usuarioId: usuario.id,
      });

      return res.json({
        token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          cpf: usuario.cpf,
          email: usuario.email,
          role: usuario.role,
          professorId: professor?.id ?? null,
        },
      });
    } catch (error) {
      console.error("Erro no login:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  router.post("/recuperar-senha", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email é obrigatório" });
      }

      const usuario = await prisma.usuario.findUnique({ where: { email } });
      if (!usuario) {
        return res.status(404).json({ error: "Nenhum usuário encontrado com este email" });
      }

      const senhaPadrao = "1234";
      const hash = await bcrypt.hash(senhaPadrao, 10);
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { senha: hash },
      });

      return res.json({ message: `Senha redefinida para "${senhaPadrao}"` });
    } catch (error) {
      console.error("Erro ao recuperar senha:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  router.put("/senha", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { senhaAtual, senhaNova } = req.body;
      if (!senhaAtual || !senhaNova) {
        return res.status(400).json({ error: "Senha atual e nova são obrigatórias" });
      }
      if (senhaNova.length < 4) {
        return res.status(400).json({ error: "A nova senha deve ter no mínimo 4 caracteres" });
      }

      const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.usuarioId } });
      if (!usuario) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
      if (!senhaValida) {
        return res.status(401).json({ error: "Senha atual incorreta" });
      }

      const hash = await bcrypt.hash(senhaNova, 10);
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { senha: hash },
      });

      return res.json({ message: "Senha alterada com sucesso" });
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  router.get("/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.user!.usuarioId },
        select: { id: true, nome: true, cpf: true, email: true, telefone: true, role: true },
      });
      if (!usuario) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      const professor = await prisma.professor.findUnique({ where: { usuarioId: usuario.id } });
      return res.json({ ...usuario, professorId: professor?.id ?? null });
    } catch (error) {
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  router.put("/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { nome, email, telefone } = req.body;
      if (!nome || !email || !telefone) {
        return res.status(400).json({ error: "Nome, email e telefone são obrigatórios" });
      }

      const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.usuarioId } });
      if (!usuario) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const emailExistente = await prisma.usuario.findFirst({
        where: { email, id: { not: usuario.id } },
      });
      if (emailExistente) {
        return res.status(409).json({ error: "Este email já está em uso por outro usuário" });
      }

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { nome, email, telefone },
      });

      const updated = await prisma.usuario.findUnique({
        where: { id: usuario.id },
        select: { id: true, nome: true, cpf: true, email: true, telefone: true, role: true },
      });
      const professor = await prisma.professor.findUnique({ where: { usuarioId: usuario.id } });

      return res.json({ ...updated, professorId: professor?.id ?? null });
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  return router;
}
