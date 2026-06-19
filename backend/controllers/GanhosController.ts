import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";
import { authMiddleware } from "../middleware/auth.js";

export default function GanhosController(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/", authMiddleware, async (req, res) => {
    try {
      const { dataInicio, dataFim, professorId, status } = req.query as Record<string, string | undefined>;

      const where: Record<string, unknown> = {};
      if (status) {
        where.status = status;
      } else if (req.user?.role === "PROFESSOR") {
        where.status = { in: ["AGENDADO", "CONCLUIDO"] };
      }
      if (dataInicio || dataFim) {
        const dataFilter: Record<string, Date> = {};
        if (dataInicio) dataFilter.gte = new Date(dataInicio);
        if (dataFim) dataFilter.lte = new Date(dataFim + "T23:59:59");
        where.data = dataFilter;
      }
      if (professorId) {
        where.professorId = professorId;
      } else if (req.user?.role === "PROFESSOR") {
        where.professorId = req.user.id;
      }

      const agendamentos = await prisma.agendamento.findMany({
        where: where as any,
        include: {
          professor: { include: { usuario: true } },
          aluno: { include: { usuario: true } },
          sala: true,
        },
        orderBy: { data: "desc" },
      });

      const VALOR_MENSAL = 240;
      const TAXA_ESCOLA = 0.3;

      const totalAulas = agendamentos.length;
      const totalHoras = agendamentos.reduce((acc, a) => acc + a.duracao, 0);

      const aulasPorProfessor = new Map<string, typeof agendamentos>();
      const alunoMesPorProfessor = new Map<string, Set<string>>();
      const alunoMesPorMes = new Map<string, Set<string>>();
      const aulasPorMes = new Map<string, number>();

      for (const a of agendamentos) {
        if ((a.valor ?? VALOR_MENSAL) === 0) continue;

        const mes = a.data.toISOString().slice(0, 7);
        const chave = `${a.alunoId}-${mes}`;

        if (!aulasPorProfessor.has(a.professorId)) {
          aulasPorProfessor.set(a.professorId, []);
        }
        aulasPorProfessor.get(a.professorId)!.push(a);

        aulasPorMes.set(mes, (aulasPorMes.get(mes) ?? 0) + 1);

        if (!alunoMesPorProfessor.has(a.professorId)) alunoMesPorProfessor.set(a.professorId, new Set());
        alunoMesPorProfessor.get(a.professorId)!.add(chave);

        if (!alunoMesPorMes.has(mes)) alunoMesPorMes.set(mes, new Set());
        alunoMesPorMes.get(mes)!.add(chave);
      }

      let totalAlunoMes = 0;
      for (const set of alunoMesPorProfessor.values()) totalAlunoMes += set.size;

      const totalBruto = totalAlunoMes * VALOR_MENSAL;
      const totalLiquidoEscola = Math.round(totalBruto * TAXA_ESCOLA * 100) / 100;

      const porProfessor = Array.from(alunoMesPorProfessor.entries()).map(([id, set]) => {
        const aulas = aulasPorProfessor.get(id) ?? [];
        const aulasCount = aulas.length;
        const horas = aulas.reduce((s, a) => s + a.duracao, 0);
        const alunoMeses = set.size;
        const valor = alunoMeses * VALOR_MENSAL;
        const porcentagem = totalBruto > 0 ? Math.round((valor / totalBruto) * 10000) / 100 : 0;
        const professorShare = Math.round(valor * (1 - TAXA_ESCOLA) * 100) / 100;

        return {
          id,
          nome: aulas[0]?.professor.usuario.nome ?? "",
          aulas: aulasCount,
          horas,
          valor: Math.round(valor * 100) / 100,
          alunoMeses,
          porcentagem,
          professorShare,
        };
      });

      porProfessor.sort((a, b) => b.valor - a.valor);

      const porMes = Array.from(alunoMesPorMes.entries()).map(([mes, set]) => {
        const valor = set.size * VALOR_MENSAL;
        return {
          mes,
          aulas: aulasPorMes.get(mes) ?? 0,
          valor: Math.round(valor * 100) / 100,
          professorShare: Math.round(valor * (1 - TAXA_ESCOLA) * 100) / 100,
        };
      }).sort((a, b) => a.mes.localeCompare(b.mes));

      return res.json({
        resumo: {
          totalBruto: Math.round(totalBruto * 100) / 100,
          totalLiquidoEscola,
          totalLiquidoProfessor: Math.round(totalBruto * (1 - TAXA_ESCOLA) * 100) / 100,
          totalAulas,
          totalHoras,
          mediaPorAula: totalAulas > 0 ? Math.round((totalBruto / totalAulas) * 100) / 100 : 0,
          mediaAlunoMes: totalAlunoMes > 0 ? VALOR_MENSAL : 0,
          periodo: {
            de: dataInicio ?? null,
            ate: dataFim ?? null,
          },
        },
        porProfessor,
        porMes,
        aulas: agendamentos,
        totalFiltrado: agendamentos.length,
      });
    } catch (error) {
      console.error("Erro ao consultar ganhos:", error);
      return res.status(500).json({ error: "Erro ao consultar ganhos" });
    }
  });

  return router;
}
