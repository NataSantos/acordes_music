import { Router } from "express";
import type { Request, Response } from "express";
import type { PrismaClient } from "../generated/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin, requireAdminOrProfessor } from "../middleware/roles.js";
import { agendamentoSchema, extrairPrimeiroErro } from "../utils/validation.js";
import { ZodError } from "zod";

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

  async function getProfessorIdByUsuarioId(usuarioId: string): Promise<string | null> {
    const professor = await prisma.professor.findUnique({ where: { usuarioId } });
    return professor?.id ?? null;
  }

  async function getAlunoIdByUsuarioId(usuarioId: string): Promise<string | null> {
    const aluno = await prisma.aluno.findUnique({ where: { usuarioId } });
    return aluno?.id ?? null;
  }

  router.get("/", authMiddleware, async (req: Request, res: Response) => {
    try {
      const where: Record<string, unknown> = {};

      // Role-based filtering
      if (req.user?.role === "ALUNO") {
        const alunoId = await getAlunoIdByUsuarioId(req.user.usuarioId);
        if (!alunoId) return res.json([]);
        where.alunoId = alunoId;
      } else if (req.user?.role === "PROFESSOR") {
        const professorId = await getProfessorIdByUsuarioId(req.user.usuarioId);
        if (!professorId) return res.json([]);
        where.professorId = professorId;
      }
      // ADMIN sees all

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

  router.get("/verificar-conflito", authMiddleware, async (req: Request, res: Response) => {
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

  router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const agendamento = await prisma.agendamento.findUnique({
        where: { id: req.params.id as string },
        include,
      });
      if (!agendamento) return res.status(404).json(notFound());

      if (req.user?.role === "ALUNO") {
        const alunoId = await getAlunoIdByUsuarioId(req.user.usuarioId);
        if (agendamento.alunoId !== alunoId) {
          return res.status(403).json({ error: "Você não tem permissão para visualizar este agendamento" });
        }
      } else if (req.user?.role === "PROFESSOR") {
        const professorId = await getProfessorIdByUsuarioId(req.user.usuarioId);
        if (agendamento.professorId !== professorId) {
          return res.status(403).json({ error: "Você não tem permissão para visualizar este agendamento" });
        }
      }

      return res.json(agendamento);
    } catch (error) {
      console.error("Erro ao buscar agendamento:", error);
      return res.status(500).json({ error: "Erro ao buscar agendamento" });
    }
  });

  router.post("/", authMiddleware, requireAdminOrProfessor, async (req: Request, res: Response) => {
    try {
      const data = agendamentoSchema.parse(req.body);

      const conflitos = await verificarConflitos({
        professorId: data.professorId,
        alunoId: data.alunoId,
        salaId: data.salaId,
        data: data.data,
        horario: data.horario,
        duracao: data.duracao,
      });
      if (conflitos.length > 0) {
        return res.status(409).json({ error: "Conflito de horário", conflitos });
      }

      const agendamento = await prisma.agendamento.create({
          data: {
          professorId: data.professorId,
          alunoId: data.alunoId,
          salaId: data.salaId,
          data: new Date(data.data),
          horario: data.horario,
          duracao: data.duracao,
          valor: data.valor !== undefined && data.valor !== null && data.valor !== '' ? Number(data.valor) : null,
          observacao: data.observacao ?? null,
        },
        include,
      });
      return res.status(201).json(agendamento);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: extrairPrimeiroErro(error) });
      }
      console.error("Erro ao cadastrar agendamento:", error);
      return res.status(500).json({ error: "Erro ao cadastrar agendamento" });
    }
  });

  router.put("/:id", authMiddleware, requireAdminOrProfessor, async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
      const data = agendamentoSchema.partial().parse(req.body);

      const atual = await prisma.agendamento.findUnique({ where: { id } });
      if (!atual) return res.status(404).json(notFound());

      if (data.data || data.horario || data.duracao) {
        const conflitos = await verificarConflitos({
          professorId: data.professorId ?? atual.professorId,
          alunoId: data.alunoId ?? atual.alunoId,
          salaId: data.salaId ?? atual.salaId,
          data: data.data ?? atual.data.toISOString().slice(0, 10),
          horario: data.horario ?? atual.horario,
          duracao: data.duracao ?? atual.duracao,
          ignorarId: id,
        });
        if (conflitos.length > 0) {
          return res.status(409).json({ error: "Conflito de horário", conflitos });
        }
      }

      const agendamento = await prisma.agendamento.update({
        where: { id },
        data: {
          ...(data.professorId !== undefined && { professorId: data.professorId }),
          ...(data.alunoId !== undefined && { alunoId: data.alunoId }),
          ...(data.salaId !== undefined && { salaId: data.salaId }),
          ...(data.data !== undefined && { data: new Date(data.data) }),
          ...(data.horario !== undefined && { horario: data.horario }),
          ...(data.duracao !== undefined && { duracao: data.duracao }),
          ...(data.valor !== undefined && { valor: data.valor !== null && data.valor !== '' ? Number(data.valor) : null }),
          ...(data.observacao !== undefined && { observacao: data.observacao }),
        } as any,
        include,
      });
      return res.json(agendamento);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: extrairPrimeiroErro(error) });
      }
      console.error("Erro ao atualizar agendamento:", error);
      return res.status(404).json(notFound());
    }
  });

  router.delete("/:id", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
      await prisma.agendamento.delete({ where: { id } });
      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao remover agendamento:", error);
      return res.status(404).json(notFound());
    }
  });

  router.patch("/:id/registrar", authMiddleware, requireAdminOrProfessor, async (req: Request, res: Response) => {
    const id = req.params.id as string;
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
