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

      const TAXA_ESCOLA = 0.3;

      const aulasPgas = agendamentos.filter(a => (a.valor ?? 0) > 0);

      const totalAulas = aulasPgas.length;
      const totalHoras = Math.round((aulasPgas.reduce((acc, a) => acc + a.duracao, 0) / 60) * 100) / 100;

      const aulasPorProfessor = new Map<string, typeof agendamentos>();
      const alunosPorProfessor = new Map<string, Map<string, number>>();
      const aulasPorMes = new Map<string, number>();
      const alunosPorMes = new Map<string, Map<string, number>>();
      const profsPorAluno = new Map<string, Set<string>>();
      const aulasPorAluno = new Map<string, number>();

      for (const a of aulasPgas) {
        const mes = a.data.toISOString().slice(0, 7);

        if (!aulasPorProfessor.has(a.professorId)) aulasPorProfessor.set(a.professorId, []);
        aulasPorProfessor.get(a.professorId)!.push(a);

        aulasPorMes.set(mes, (aulasPorMes.get(mes) ?? 0) + 1);

        if (!alunosPorProfessor.has(a.professorId)) alunosPorProfessor.set(a.professorId, new Map());
        if (!alunosPorProfessor.get(a.professorId)!.has(a.alunoId)) alunosPorProfessor.get(a.professorId)!.set(a.alunoId, a.valor ?? 0);

        if (!alunosPorMes.has(mes)) alunosPorMes.set(mes, new Map());
        if (!alunosPorMes.get(mes)!.has(a.alunoId)) alunosPorMes.get(mes)!.set(a.alunoId, a.valor ?? 0);

        if (!profsPorAluno.has(a.alunoId)) profsPorAluno.set(a.alunoId, new Set());
        profsPorAluno.get(a.alunoId)!.add(a.professorId);

        aulasPorAluno.set(a.alunoId, (aulasPorAluno.get(a.alunoId) ?? 0) + 1);
      }

      const totalAlunosUnicos = new Set(agendamentos.map(a => a.alunoId)).size;
      const totalAlunosMultiProfessor = Array.from(profsPorAluno.values()).filter(s => s.size >= 2).length;
      const totalAlunosMultiAula = Array.from(aulasPorAluno.values()).filter(c => c > 1).length;

      const calcValorBruto = (map: Map<string, number>) =>
        Array.from(map.values()).reduce((s, v) => s + v, 0);

      const totalBruto = calcValorBruto(
        Array.from(alunosPorMes.values()).reduce((acc, m) => {
          for (const [id, v] of m) { if (!acc.has(id)) acc.set(id, v); }
          return acc;
        }, new Map<string, number>())
      );

      const totalLiquidoEscola = Math.round(totalBruto * TAXA_ESCOLA * 100) / 100;

      const porProfessor = Array.from(aulasPorProfessor.entries()).map(([id, aulas]) => {
        const aulasCount = aulas.length;
        const horas = Math.round((aulas.reduce((s, a) => s + a.duracao, 0) / 60) * 100) / 100;
        const valor = calcValorBruto(alunosPorProfessor.get(id) ?? new Map());
        const porcentagem = totalBruto > 0 ? Math.round((valor / totalBruto) * 10000) / 100 : 0;
        const professorShare = Math.round(valor * (1 - TAXA_ESCOLA) * 100) / 100;
        const alunos = alunosPorProfessor.get(id)?.size ?? 0;

        return {
          id,
          nome: aulas[0]?.professor.usuario.nome ?? "",
          aulas: aulasCount,
          horas,
          valor: Math.round(valor * 100) / 100,
          alunoMeses: alunos,
          alunos,
          porcentagem,
          professorShare,
        };
      });

      porProfessor.sort((a, b) => b.valor - a.valor);

      const porMes = Array.from(aulasPorMes.entries()).map(([mes, aulasCount]) => {
        const alunos = alunosPorMes.get(mes) ?? new Map();
        const valor = calcValorBruto(alunos);
        return {
          mes,
          aulas: aulasCount,
          alunos: alunos.size,
          alunoMeses: alunos.size,
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
          totalAlunoMes: totalAlunosUnicos,
          totalAlunosUnicos,
          totalAlunosMultiProfessor,
          totalAlunosMultiAula,
          mediaPorAula: totalAulas > 0 ? Math.round((totalBruto / totalAulas) * 100) / 100 : 0,
          mediaAlunoMes: totalAlunosUnicos > 0 ? Math.round((totalBruto / totalAlunosUnicos) * 100) / 100 : 0,
          periodo: {
            de: dataInicio ?? null,
            ate: dataFim ?? null,
          },
        },
        porProfessor,
        porMes,
        aulas: aulasPgas,
        totalFiltrado: aulasPgas.length,
      });
    } catch (error) {
      console.error("Erro ao consultar ganhos:", error);
      return res.status(500).json({ error: "Erro ao consultar ganhos" });
    }
  });

  return router;
}
