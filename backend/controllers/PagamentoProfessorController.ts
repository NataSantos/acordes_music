import { Router } from "express";
import type { Request, Response } from "express";
import type { PrismaClient } from "../generated/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin, requireAdminOrProfessor } from "../middleware/roles.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import crypto from "node:crypto";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Apenas imagens são permitidas para comprovante"));
      return;
    }
    cb(null, true);
  },
});

const r2 = (() => {
  const accountId = process.env.R2_ACCOUNT_ID ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY ?? "";
  const secretAccessKey = process.env.R2_SECRET_KEY ?? "";
  const bucketName = process.env.R2_BUCKET ?? "";
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) return null;
  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket: bucketName,
  };
})();

const VALOR_MENSAL = 240;
const TAXA_ESCOLA = 0.3;

export default function PagamentoProfessorController(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/", authMiddleware, requireAdminOrProfessor, async (req, res) => {
    try {
      const now = new Date();
      const mes = Number(req.query.mes) || now.getMonth() + 1;
      const ano = Number(req.query.ano) || now.getFullYear();

      const primeiroDia = new Date(ano, mes - 1, 1);
      const ultimoDia = new Date(ano, mes, 0, 23, 59, 59);

      const professores = await prisma.professor.findMany({
        include: {
          usuario: true,
          agendamentos: {
            where: {
              data: { gte: primeiroDia, lte: ultimoDia },
              valor: { not: 0 },
            },
            include: { aluno: { include: { usuario: true } }, sala: true },
          },
          pagamentosProfessor: {
            orderBy: [{ ano: "desc" }, { mes: "desc" }],
          },
        },
        orderBy: { usuario: { nome: "asc" } },
      });

      const data = professores.map(p => {
        const aulas = p.agendamentos;
        const totalAulas = aulas.length;
        const totalHoras = aulas.reduce((s, a) => s + a.duracao, 0);
        const alunosUnicos = new Set(aulas.map(a => a.alunoId)).size;
        const alunoMeses = aulas.reduce((acc, a) => {
          const chave = `${a.alunoId}-${mes}`;
          acc.add(chave);
          return acc;
        }, new Set<string>()).size;
        const valorBruto = alunoMeses * VALOR_MENSAL;
        const valorReceber = Math.round(valorBruto * (1 - TAXA_ESCOLA) * 100) / 100;

        const pagamentoProf = p.pagamentosProfessor.find(pp => pp.mes === mes && pp.ano === ano) ?? null;
        const historicoPagamentos = p.pagamentosProfessor.filter(pp => pp.pago).map(pp => ({
          id: pp.id,
          mes: pp.mes,
          ano: pp.ano,
          valor: pp.valor,
          tipoPagamento: pp.tipoPagamento,
          pagoEm: pp.pagoEm,
          comprovanteUrl: pp.comprovanteUrl,
        }));

        return {
          id: p.id,
          nome: p.usuario.nome,
          aulas: aulas.map(a => ({
            id: a.id,
            data: a.data,
            horario: a.horario,
            duracao: a.duracao,
            aluno: a.aluno.usuario.nome,
            sala: a.sala.nome,
          })),
          totalAulas,
          totalHoras,
          alunosUnicos,
          valorBruto,
          valorReceber,
          pago: pagamentoProf?.pago ?? false,
          pagamentoProf: pagamentoProf ? {
            id: pagamentoProf.id,
            valor: pagamentoProf.valor,
            pago: pagamentoProf.pago,
            pagoEm: pagamentoProf.pagoEm,
            tipoPagamento: pagamentoProf.tipoPagamento,
            comprovanteUrl: pagamentoProf.comprovanteUrl,
          } : null,
          historicoPagamentos,
        };
      });

      return res.json({ mes, ano, professores: data });
    } catch (error) {
      console.error("Erro ao consultar pagamentos de professores:", error);
      return res.status(500).json({ error: "Erro ao consultar pagamentos de professores" });
    }
  });

  router.post("/pagar", authMiddleware, requireAdmin, upload.single("comprovante"), async (req: Request, res: Response) => {
    try {
      const { professorId, mes: reqMes, ano: reqAno, valor, tipoPagamento } = req.body;
      if (!professorId) return res.status(400).json({ error: "professorId é obrigatório" });

      const now = new Date();
      const mes = Number(reqMes) || now.getMonth() + 1;
      const ano = Number(reqAno) || now.getFullYear();

      const professor = await prisma.professor.findUnique({ where: { id: professorId } });
      if (!professor) return res.status(404).json({ error: "Professor não encontrado" });

      let comprovanteUrl: string | null = null;

      if (r2 && req.file) {
        const ext = req.file.originalname.split(".").pop() ?? "jpg";
        const key = `comprovante-professor/${professorId}/${ano}-${String(mes).padStart(2, "0")}-${crypto.randomUUID()}.${ext}`;

        await r2.client.send(new PutObjectCommand({
          Bucket: r2.bucket,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        }));

        comprovanteUrl = key;
      }

      const existente = await prisma.pagamentoProfessor.findUnique({
        where: { professorId_mes_ano: { professorId, mes, ano } },
      });

      let pagamento;
      const pagamentoData: Record<string, unknown> = { pago: true, pagoEm: now, comprovanteUrl };
      if (valor != null) pagamentoData.valor = Number(valor);
      if (tipoPagamento) pagamentoData.tipoPagamento = tipoPagamento;
      else pagamentoData.tipoPagamento = "PIX";

      if (existente) {
        if (existente.pago) return res.json(existente);
        pagamento = await prisma.pagamentoProfessor.update({
          where: { id: existente.id },
          data: pagamentoData as any,
        });
      } else {
        pagamento = await prisma.pagamentoProfessor.create({
          data: { professorId, mes, ano, ...pagamentoData } as any,
        });
      }

      return res.status(existente ? 200 : 201).json(pagamento);
    } catch (error) {
      console.error("Erro ao registrar pagamento do professor:", error);
      return res.status(500).json({ error: "Erro ao registrar pagamento do professor" });
    }
  });

  router.get("/comprovante/:pagamentoId", async (req, res) => {
    try {
      const pagamento = await prisma.pagamentoProfessor.findUnique({
        where: { id: req.params.pagamentoId },
      });
      if (!pagamento?.comprovanteUrl) {
        return res.status(404).json({ error: "Comprovante não encontrado" });
      }
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      if (!r2) {
        return res.status(500).json({ error: "R2 não configurado" });
      }
      const command = new GetObjectCommand({
        Bucket: r2.bucket,
        Key: pagamento.comprovanteUrl,
      });
      const response = await r2.client.send(command);
      const contentType = response.ContentType || "image/png";
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=86400");
      const stream = response.Body as import("stream").Readable;
      return stream.pipe(res);
    } catch (error) {
      console.error("Erro ao buscar comprovante:", error);
      return res.status(500).json({ error: "Erro ao buscar comprovante" });
    }
  });

  router.get("/relatorio", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const mes = Number(req.query.mes) || now.getMonth() + 1;
      const ano = Number(req.query.ano) || now.getFullYear();

      const primeiroDia = new Date(ano, mes - 1, 1);
      const ultimoDia = new Date(ano, mes, 0, 23, 59, 59);

      const professores = await prisma.professor.findMany({
        include: {
          usuario: true,
          agendamentos: {
            where: {
              data: { gte: primeiroDia, lte: ultimoDia },
              valor: { not: 0 },
            },
            include: { aluno: { include: { usuario: true } }, sala: true },
            orderBy: { data: "asc" },
          },
        },
        orderBy: { usuario: { nome: "asc" } },
      });

      const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

      let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Pagamentos - Professores</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1a1a2e; background: #f8f7fc; }
    .header { text-align: center; margin-bottom: 28px; }
    .header h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 4px; }
    .header .periodo { font-size: 14px; color: #7c3aed; font-weight: 600; }
    .header .info { font-size: 12px; color: #888; margin-top: 4px; }

    .professor { background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); margin-bottom: 28px; padding: 20px; page-break-inside: avoid; }
    .professor h2 { font-size: 17px; margin-bottom: 12px; border-left: 4px solid #7c3aed; padding-left: 12px; color: #1a1a2e; }

    .resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 16px; }
    .resumo-item { background: #f5f3ff; border-radius: 6px; padding: 10px 12px; }
    .resumo-item .label { font-size: 10px; text-transform: uppercase; color: #7c3aed; font-weight: 700; letter-spacing: 0.5px; }
    .resumo-item .value { font-size: 16px; font-weight: 700; color: #1a1a2e; margin-top: 2px; }
    .resumo-item .value.sub { font-size: 13px; color: #666; }

    .alunos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px; margin-bottom: 12px; }
    .aluno-card { border: 1px solid #e8e4f0; border-radius: 6px; overflow: hidden; }
    .aluno-header { background: #faf9ff; padding: 8px 12px; font-size: 13px; font-weight: 600; color: #1a1a2e; border-bottom: 1px solid #e8e4f0; display: flex; justify-content: space-between; align-items: center; }
    .aluno-header .aulas-info { font-size: 11px; font-weight: 400; color: #888; }
    .aluno-valores { display: flex; gap: 12px; padding: 8px 12px; font-size: 12px; background: #fcfbff; }
    .aluno-valores span { flex: 1; }
    .aluno-valores .valor-destaque { color: #059669; font-weight: 600; }

    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f5f3ff; text-align: left; padding: 5px 8px; font-weight: 600; color: #555; border-bottom: 1px solid #e2e8f0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    td { padding: 4px 8px; border-bottom: 1px solid #f1f5f9; color: #444; }

    .total-geral { background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border-radius: 8px; padding: 16px 20px; margin-top: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .total-geral .total-item { text-align: center; }
    .total-geral .total-item .label { font-size: 10px; text-transform: uppercase; opacity: 0.8; letter-spacing: 0.5px; }
    .total-geral .total-item .value { font-size: 18px; font-weight: 700; margin-top: 2px; }

    .divisao { display: flex; gap: 12px; margin-top: 10px; }
    .divisao-item { flex: 1; background: #f0fdf4; border-radius: 6px; padding: 10px 12px; text-align: center; }
    .divisao-item.escola { background: #fef2f2; }
    .divisao-item .label { font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
    .divisao-item .value { font-size: 15px; font-weight: 700; margin-top: 2px; }
    .divisao-item .value.prof { color: #059669; }
    .divisao-item .value.escola { color: #dc2626; }

    .footer { margin-top: 24px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { padding: 15px; background: #fff; } .professor { box-shadow: none; border: 1px solid #eee; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Relatório de Pagamentos — Professores</h1>
    <div class="periodo">${meses[mes - 1]} de ${ano}</div>
    <div class="info">Escola de Música Acordes</div>
  </div>`;

      let totalGeralBruto = 0;
      let totalGeralEscola = 0;
      let totalGeralProfessor = 0;
      let totalGeralAulas = 0;
      let totalGeralAlunos = 0;

      for (const p of professores) {
        const aulas = p.agendamentos.filter(a => (a.valor ?? VALOR_MENSAL) !== 0);
        if (aulas.length === 0) continue;

        const totalAulas = aulas.length;
        const totalHoras = aulas.reduce((s, a) => s + a.duracao, 0);
        const alunosUnicos = new Set(aulas.map(a => a.alunoId)).size;
        const alunoMeses = new Set(aulas.map(a => `${a.alunoId}-${mes}`)).size;
        const valorBruto = alunoMeses * VALOR_MENSAL;
        const valorEscola = Math.round(valorBruto * TAXA_ESCOLA * 100) / 100;
        const valorReceber = Math.round(valorBruto * (1 - TAXA_ESCOLA) * 100) / 100;

        totalGeralBruto += valorBruto;
        totalGeralEscola += valorEscola;
        totalGeralProfessor += valorReceber;
        totalGeralAulas += totalAulas;
        totalGeralAlunos += alunosUnicos;

        // Agrupar aulas por aluno
        const aulasPorAluno = new Map<string, typeof aulas>();
        for (const a of aulas) {
          const existente = aulasPorAluno.get(a.alunoId) ?? [];
          existente.push(a);
          aulasPorAluno.set(a.alunoId, existente);
        }

        html += `<div class="professor">
  <h2>${p.usuario.nome}</h2>
  <div class="resumo">
    <div class="resumo-item"><div class="label">Aulas</div><div class="value">${totalAulas}</div></div>
    <div class="resumo-item"><div class="label">Horas</div><div class="value">${totalHoras}h</div></div>
    <div class="resumo-item"><div class="label">Alunos</div><div class="value">${alunosUnicos}</div></div>
    <div class="resumo-item"><div class="label">Valor Bruto</div><div class="value">R$ ${valorBruto.toFixed(2)}</div></div>
  </div>

  <div style="font-size:13px;font-weight:600;color:#1a1a2e;margin-bottom:8px;">Alunos atendidos</div>
  <div class="alunos-grid">`;

        for (const [alunoId, aulasAluno] of aulasPorAluno) {
          const totalHorasAluno = aulasAluno.reduce((s, a) => s + a.duracao, 0);
          html += `<div class="aluno-card">
      <div class="aluno-header">
        <span>${aulasAluno[0]!.aluno.usuario.nome}</span>
        <span class="aulas-info">${aulasAluno.length} aula${aulasAluno.length !== 1 ? "s" : ""} · ${totalHorasAluno}h</span>
      </div>
      <div class="aluno-valores">
        <span>Valor mensal: <strong>R$ ${VALOR_MENSAL.toFixed(2)}</strong></span>
        <span class="valor-destaque">Valor professor (70%): R$ ${(VALOR_MENSAL * 0.7).toFixed(2)}</span>
      </div>
      <table>
        <thead><tr><th>Data</th><th>Horário</th><th>Sala</th></tr></thead>
        <tbody>`;
          for (const a of aulasAluno) {
            const data = a.data.toLocaleDateString("pt-BR");
            html += `<tr><td>${data}</td><td>${a.horario}</td><td>${a.sala.nome}</td></tr>`;
          }
          html += `</tbody></table>
    </div>`;
        }

        html += `</div>
  <div class="divisao">
    <div class="divisao-item">
      <div class="label">Escola (30%)</div>
      <div class="value escola">R$ ${valorEscola.toFixed(2)}</div>
    </div>
    <div class="divisao-item">
      <div class="label">Professor (70%)</div>
      <div class="value prof">R$ ${valorReceber.toFixed(2)}</div>
    </div>
  </div>
</div>`;
      }

      html += `<div class="total-geral">
    <div class="total-item"><div class="label">Total de Aulas</div><div class="value">${totalGeralAulas}</div></div>
    <div class="total-item"><div class="label">Total de Alunos</div><div class="value">${totalGeralAlunos}</div></div>
    <div class="total-item"><div class="label">Valor Bruto Total</div><div class="value">R$ ${totalGeralBruto.toFixed(2)}</div></div>
    <div class="total-item"><div class="label">Total Escola (30%)</div><div class="value">R$ ${totalGeralEscola.toFixed(2)}</div></div>
    <div class="total-item"><div class="label">Total Professores (70%)</div><div class="value">R$ ${totalGeralProfessor.toFixed(2)}</div></div>
  </div>

  <div class="footer">Relatório gerado em ${new Date().toLocaleString("pt-BR")} · Escola de Música Acordes</div>
  ${req.query.print === "true" ? "<script>window.onload=()=>{window.print();}</script>" : ""}
</body></html>`;

      res.set("Content-Type", "text/html");
      return res.send(html);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      return res.status(500).json({ error: "Erro ao gerar relatório" });
    }
  });

  return router;
}
