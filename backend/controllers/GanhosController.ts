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

      const valorMensal = 240;
      const totalAulas = agendamentos.length;
      const totalHoras = agendamentos.reduce((acc, a) => acc + a.duracao, 0);

      const alunoMesPorProfessor = new Map<string, Set<string>>();
      const alunoMesPorMes = new Map<string, Set<string>>();
      const aulasPorProfessor = new Map<string, number>();
      const aulasPorMes = new Map<string, number>();

      for (const a of agendamentos) {
        if (a.valor === 0) continue;

        const pid = a.professorId;
        const mes = a.data.toISOString().slice(0, 7);
        const chave = `${a.alunoId}-${mes}`;

        aulasPorProfessor.set(pid, (aulasPorProfessor.get(pid) ?? 0) + 1);
        aulasPorMes.set(mes, (aulasPorMes.get(mes) ?? 0) + 1);

        if (!alunoMesPorProfessor.has(pid)) alunoMesPorProfessor.set(pid, new Set());
        alunoMesPorProfessor.get(pid)!.add(chave);

        if (!alunoMesPorMes.has(mes)) alunoMesPorMes.set(mes, new Set());
        alunoMesPorMes.get(mes)!.add(chave);
      }

      let totalAlunoMes = 0;
      for (const set of alunoMesPorProfessor.values()) totalAlunoMes += set.size;

      const totalBruto = totalAlunoMes * valorMensal;

      const porProfessor = Array.from(alunoMesPorProfessor.entries()).map(([id, set]) => ({
        id,
        nome: agendamentos.find(a => a.professorId === id)?.professor.usuario.nome ?? "",
        aulas: aulasPorProfessor.get(id) ?? 0,
        horas: agendamentos.filter(a => a.professorId === id).reduce((s, a) => s + a.duracao, 0),
        valor: set.size * valorMensal,
        professorShare: Math.round(set.size * valorMensal * 0.7 * 100) / 100,
      }));

      const porMes = Array.from(alunoMesPorMes.entries()).map(([mes, set]) => ({
        mes,
        aulas: aulasPorMes.get(mes) ?? 0,
        valor: set.size * valorMensal,
        professorShare: Math.round(set.size * valorMensal * 0.7 * 100) / 100,
      })).sort((a, b) => a.mes.localeCompare(b.mes));

      return res.json({
        resumo: {
          totalBruto: Math.round(totalBruto * 100) / 100,
          totalLiquido: Math.round(totalBruto * 0.7 * 100) / 100,
          totalAulas,
          totalHoras,
          mediaPorAula: totalAulas > 0 ? Math.round((totalBruto / totalAulas) * 100) / 100 : 0,
          mediaAlunoMes: totalAlunoMes > 0 ? Math.round((totalBruto / totalAlunoMes) * 100) / 100 : 240,
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
