import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/roles.js";
import { salaSchema, extrairPrimeiroErro } from "../utils/validation.js";
import { ZodError } from "zod";

export default function SalaController(prisma: PrismaClient): Router {
  const router = Router();

  const notFound = () => ({ error: "Sala não encontrada" });

  router.get("/", authMiddleware, async (_req, res) => {
    try {
      const salas = await prisma.sala.findMany({ orderBy: { nome: "asc" } });
      return res.json(salas);
    } catch (error) {
      console.error("Erro ao buscar salas:", error);
      return res.status(500).json({ error: "Erro ao buscar salas" });
    }
  });

  router.post("/", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const data = salaSchema.parse(req.body);
      const existente = await prisma.sala.findFirst({ where: { nome: data.nome } });
      if (existente) {
        return res.status(409).json({ error: `Já existe uma sala cadastrada com o nome "${data.nome}"` });
      }
      const sala = await prisma.sala.create({
        data: { nome: data.nome, capacidade: data.capacidade, descricao: data.descricao ?? null },
      });
      return res.status(201).json(sala);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: extrairPrimeiroErro(error) });
      }
      console.error("Erro ao cadastrar sala:", error);
      return res.status(500).json({ error: "Erro ao cadastrar sala" });
    }
  });

  router.put("/:id", authMiddleware, requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    try {
      const data = salaSchema.partial().parse(req.body);
      if (data.nome !== undefined) {
        const existente = await prisma.sala.findFirst({ where: { nome: data.nome, NOT: { id } as any } });
        if (existente) {
          return res.status(409).json({ error: `Já existe outra sala cadastrada com o nome "${data.nome}"` });
        }
      }
      const sala = await prisma.sala.update({
        where: { id },
        data: {
          ...(data.nome !== undefined && { nome: data.nome }),
          ...(data.capacidade !== undefined && { capacidade: data.capacidade }),
          ...(data.descricao !== undefined && { descricao: data.descricao }),
        },
      });
      return res.json(sala);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: extrairPrimeiroErro(error) });
      }
      console.error("Erro ao atualizar sala:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", authMiddleware, requireAdmin, async (req, res) => {
    const id = req.params.id as string;
    try {
      const agendamentos = await prisma.agendamento.count({ where: { salaId: id } });
      if (agendamentos > 0) {
        return res.status(409).json({ error: "Sala possui agendamentos vinculados. Remova-os antes de excluir." });
      }
      await prisma.sala.delete({ where: { id } });
      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao remover sala:", error);
      return res.status(404).json(notFound());
    }
  });

  return router;
}
