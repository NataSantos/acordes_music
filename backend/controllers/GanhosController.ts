import { Router } from "express";
import type { PrismaClient } from "../generated/client.js";
import { authMiddleware } from "../middleware/auth.js";

export default function GanhosController(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/", authMiddleware, async (req, res) => {
    try {
      const { dataInicio, dataFim, professorId } = req.query as Record<string, string | undefined>;

      const where: Record<string, unknown> = { status: "CONCLUIDO" };
      if (dataInicio || dataFim) {
        const dataFilter: Record<string, Date> = {};
        if (dataInicio) dataFilter.gte = new Date(dataInicio);
        if (dataFim) dataFilter.lte = new Date(dataFim + "T23:59:59");
        where.data = dataFilter;
      }
      if (professorId) where.professorId = professorId;

      const agendamentos = await prisma.agendamento.findMany({
        where: where as any,
        include: {
          professor: { include: { usuario: true } },
          aluno: { include: { usuario: true } },
          sala: true,
        },
        orderBy: { data: "desc" },
      });

      const totalBruto = agendamentos.reduce((acc, a) => acc + (a.valor ?? 0), 0);
      const totalAulas = agendamentos.length;
      const totalHoras = agendamentos.reduce((acc, a) => acc + a.duracao, 0);

      const porProfessor = agendamentos.reduce<Record<string, { nome: string; aulas: number; valor: number; horas: number }>>((acc, a) => {
        const id = a.professorId;
        if (!acc[id]) acc[id] = { nome: a.professor.usuario.nome, aulas: 0, valor: 0, horas: 0 };
        acc[id].aulas++;
        acc[id].valor += a.valor ?? 0;
        acc[id].horas += a.duracao;
        return acc;
      }, {});

      const porMes = agendamentos.reduce<Record<string, { mes: string; aulas: number; valor: number }>>((acc, a) => {
        const mes = a.data.toISOString().slice(0, 7);
        if (!acc[mes]) acc[mes] = { mes, aulas: 0, valor: 0 };
        acc[mes].aulas++;
        acc[mes].valor += a.valor ?? 0;
        return acc;
      }, {});

      return res.json({
        resumo: {
          totalBruto: Math.round(totalBruto * 100) / 100,
          totalAulas,
          totalHoras,
          mediaPorAula: totalAulas > 0 ? Math.round((totalBruto / totalAulas) * 100) / 100 : 0,
          periodo: {
            de: dataInicio ?? null,
            ate: dataFim ?? null,
          },
        },
        porProfessor: Object.entries(porProfessor).map(([id, v]) => ({ id, ...v })),
        porMes: Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes)),
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
