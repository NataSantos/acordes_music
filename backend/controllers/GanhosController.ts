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

      const aulasPgas = agendamentos.filter(a => (a.valor ?? VALOR_MENSAL) !== 0);

      const totalAulas = aulasPgas.length;
      const totalHoras = aulasPgas.reduce((acc, a) => acc + a.duracao, 0);

      const aulasPorProfessor = new Map<string, typeof agendamentos>();
      const alunoMesPorProfessor = new Map<string, Set<string>>();
      const alunoMesPorMes = new Map<string, Set<string>>();
      const aulasPorMes = new Map<string, number>();
      const alunosPorProfessor = new Map<string, Set<string>>();
      const alunosPorMes = new Map<string, Set<string>>();
      const profsPorAluno = new Map<string, Set<string>>();
      const aulasPorAluno = new Map<string, number>();

      for (const a of aulasPgas) {

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

        if (!alunosPorProfessor.has(a.professorId)) alunosPorProfessor.set(a.professorId, new Set());
        alunosPorProfessor.get(a.professorId)!.add(a.alunoId);

        if (!alunosPorMes.has(mes)) alunosPorMes.set(mes, new Set());
        alunosPorMes.get(mes)!.add(a.alunoId);

        if (!profsPorAluno.has(a.alunoId)) profsPorAluno.set(a.alunoId, new Set());
        profsPorAluno.get(a.alunoId)!.add(a.professorId);

        aulasPorAluno.set(a.alunoId, (aulasPorAluno.get(a.alunoId) ?? 0) + 1);
      }

      let totalAlunoMes = 0;
      for (const set of alunoMesPorProfessor.values()) totalAlunoMes += set.size;

      const totalAlunosUnicos = new Set(agendamentos.map(a => a.alunoId)).size;
      const totalAlunosMultiProfessor = Array.from(profsPorAluno.values()).filter(s => s.size >= 2).length;
      const totalAlunosMultiAula = Array.from(aulasPorAluno.values()).filter(c => c > 1).length;
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
        const alunos = alunosPorProfessor.get(id)?.size ?? 0;

        return {
          id,
          nome: aulas[0]?.professor.usuario.nome ?? "",
          aulas: aulasCount,
          horas,
          valor: Math.round(valor * 100) / 100,
          alunoMeses,
          alunos,
          porcentagem,
          professorShare,
        };
      });

      porProfessor.sort((a, b) => b.valor - a.valor);

      const porMes = Array.from(alunoMesPorMes.entries()).map(([mes, set]) => {
        const alunoMeses = set.size;
        const valor = alunoMeses * VALOR_MENSAL;
        const alunos = alunosPorMes.get(mes)?.size ?? 0;
        return {
          mes,
          aulas: aulasPorMes.get(mes) ?? 0,
          alunos,
          alunoMeses,
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
          totalAlunoMes,
          totalAlunosUnicos,
          totalAlunosMultiProfessor,
          totalAlunosMultiAula,
          mediaPorAula: totalAulas > 0 ? Math.round((totalBruto / totalAulas) * 100) / 100 : 0,
          mediaAlunoMes: totalAlunoMes > 0 ? VALOR_MENSAL : 0,
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
