import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";

function timeToMin(t: string): number {
  const partes = t.split(":");
  const h = Number(partes[0]) || 0;
  const m = Number(partes[1]) || 0;
  return h * 60 + m;
}

function haConflito(
  novoInicio: number,
  novoFim: number,
  existentes: { horario: string; duracao: number }[]
): boolean {
  return existentes.some(e => {
    const ei = timeToMin(e.horario);
    const ef = ei + e.duracao;
    return novoInicio < ef && ei < novoFim;
  });
}

export default function AgendamentoController(prisma: PrismaClient): Router {
  const router = Router();

  const notFound = () => ({ error: "Agendamento não encontrado" });

  const include = {
    professor: { include: { usuario: true } },
    aluno: { include: { usuario: true } },
    sala: true,
  };

  async function verificarConflitos(params: {
    professorId: string;
    alunoId: string;
    salaId: string;
    data: string;
    horario: string;
    duracao: number;
    ignorarId?: string;
  }): Promise<string[]> {
    const { professorId, alunoId, salaId, data, horario, duracao, ignorarId } = params;
    const dataInicio = new Date(data);
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + 1);

    const where: Record<string, unknown> = {
      data: { gte: dataInicio, lt: dataFim },
      status: { in: ["AGENDADO"] },
    };
    if (ignorarId) where.id = { not: ignorarId };

    const existentes = await prisma.agendamento.findMany({ where: where as any });

    const novoInicio = timeToMin(horario);
    const novoFim = novoInicio + duracao;

    const conflitos: string[] = [];

    const profConflitos = existentes.filter(e => e.professorId === professorId);
    if (haConflito(novoInicio, novoFim, profConflitos)) {
      conflitos.push("Professor já possui agendamento neste horário");
    }

    const alunoConflitos = existentes.filter(e => e.alunoId === alunoId);
    if (haConflito(novoInicio, novoFim, alunoConflitos)) {
      conflitos.push("Aluno já possui agendamento neste horário");
    }

    const salaConflitos = existentes.filter(e => e.salaId === salaId);
    if (haConflito(novoInicio, novoFim, salaConflitos)) {
      conflitos.push("Sala já está reservada neste horário");
    }

    return conflitos;
  }

  router.get("/", async (req, res) => {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.professorId) {
        where.professorId = req.query.professorId as string;
      }
      const agendamentos = await prisma.agendamento.findMany({
        orderBy: { data: "desc" },
        where: where as any,
        include,
      });
      return res.json(agendamentos);
    } catch (error) {
      console.error("Erro ao buscar agendamentos:", error);
      return res.status(500).json({ error: "Erro ao buscar agendamentos" });
    }
  });

  router.get("/verificar-conflito", async (req, res) => {
    try {
      const { professorId, alunoId, salaId, data, horario, duracao, ignorarId } = req.query as Record<string, string>;
      if (!professorId || !alunoId || !salaId || !data || !horario || !duracao) {
        return res.status(400).json({ error: "Parâmetros obrigatórios: professorId, alunoId, salaId, data, horario, duracao" });
      }
      const conflitos = await verificarConflitos({
        professorId,
        alunoId,
        salaId,
        data,
        horario,
        duracao: Number(duracao),
        ...(ignorarId ? { ignorarId } : {}),
      });
      return res.json({ conflitos, temConflito: conflitos.length > 0 });
    } catch (error) {
      console.error("Erro ao verificar conflitos:", error);
      return res.status(500).json({ error: "Erro ao verificar conflitos" });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const agendamento = await prisma.agendamento.findUnique({
        where: { id: req.params.id },
        include,
      });
      if (!agendamento) return res.status(404).json(notFound());
      return res.json(agendamento);
    } catch (error) {
      console.error("Erro ao buscar agendamento:", error);
      return res.status(500).json({ error: "Erro ao buscar agendamento" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { professorId, alunoId, salaId, data, horario, duracao, observacao } = req.body;

      const conflitos = await verificarConflitos({
        professorId,
        alunoId,
        salaId,
        data,
        horario,
        duracao: Number(duracao),
      });
      if (conflitos.length > 0) {
        return res.status(409).json({ error: "Conflito de horário", conflitos });
      }

      const agendamento = await prisma.agendamento.create({
        data: {
          professorId,
          alunoId,
          salaId,
          data: new Date(data),
          horario,
          duracao: Number(duracao),
          observacao,
        },
        include,
      });
      return res.status(201).json(agendamento);
    } catch (error) {
      console.error("Erro ao cadastrar agendamento:", error);
      return res.status(500).json({ error: "Erro ao cadastrar agendamento" });
    }
  });

  router.put("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const { professorId, alunoId, salaId, data, horario, duracao, status, observacao } = req.body;

      if (data && horario && duracao) {
        const conflitos = await verificarConflitos({
          professorId,
          alunoId,
          salaId,
          data,
          horario,
          duracao: Number(duracao),
          ignorarId: id,
        });
        if (conflitos.length > 0) {
          return res.status(409).json({ error: "Conflito de horário", conflitos });
        }
      }

      const agendamento = await prisma.agendamento.update({
        where: { id },
        data: {
          professorId,
          alunoId,
          salaId,
          data: data ? new Date(data) : undefined,
          horario,
          duracao: duracao !== undefined ? Number(duracao) : undefined,
          status,
          observacao,
        } as any,
        include,
      });
      return res.json(agendamento);
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await prisma.agendamento.delete({ where: { id } });
      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao remover agendamento:", error);
      return res.status(404).json(notFound());
    }
  });

  router.patch("/:id/registrar", async (req, res) => {
    const { id } = req.params;
    try {
      const body = req.body || {};
      const observacao = body.observacao;
      const agendamento = await prisma.agendamento.update({
        where: { id },
        data: {
          status: "CONCLUIDO",
          ...(observacao !== undefined ? { observacao } : {}),
        },
        include,
      });
      return res.json(agendamento);
    } catch (error) {
      console.error("Erro ao registrar aula:", error);
      return res.status(404).json(notFound());
    }
  });

  return router;
}
