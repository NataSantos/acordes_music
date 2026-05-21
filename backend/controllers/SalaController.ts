import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";

export default function SalaController(prisma: PrismaClient): Router {
  const router = Router();

  const notFound = () => ({ error: "Sala não encontrada" });

  router.get("/", async (_req, res) => {
    try {
      const salas = await prisma.sala.findMany({ orderBy: { nome: "asc" } });
      return res.json(salas);
    } catch (error) {
      console.error("Erro ao buscar salas:", error);
      return res.status(500).json({ error: "Erro ao buscar salas" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { nome, capacidade, descricao } = req.body;
      const sala = await prisma.sala.create({
        data: { nome, capacidade: Number(capacidade), descricao },
      });
      return res.status(201).json(sala);
    } catch (error) {
      console.error("Erro ao cadastrar sala:", error);
      return res.status(500).json({ error: "Erro ao cadastrar sala" });
    }
  });

  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const sala = await prisma.sala.update({
        where: { id },
        data: {
          nome: req.body.nome,
          capacidade: Number(req.body.capacidade),
          descricao: req.body.descricao,
        },
      });
      return res.json(sala);
    } catch (error) {
      console.error("Erro ao atualizar sala:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
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
