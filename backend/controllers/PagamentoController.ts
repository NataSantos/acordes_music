import { Router } from "express";
import type { Request, Response } from "express";
import type { PrismaClient } from "../generated/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdminOrProfessor } from "../middleware/roles.js";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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

export default function PagamentoController(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/", authMiddleware, async (req, res) => {
    try {
      const now = new Date();
      const mes = Number(req.query.mes) || now.getMonth() + 1;
      const ano = Number(req.query.ano) || now.getFullYear();

      const primeiroDia = new Date(ano, mes - 1, 1);
      const ultimoDia = new Date(ano, mes, 0, 23, 59, 59);
      const hojeDisponivel = now.getFullYear() === ano && now.getMonth() + 1 === mes;

      const alunos = await prisma.aluno.findMany({
        where: { diaPagamento: { not: null } },
        include: {
          usuario: true,
          pagamentos: { orderBy: [{ ano: "desc" }, { mes: "desc" }] },
          agendamentos: {
            where: { data: { gte: primeiroDia, lte: ultimoDia } },
          },
        },
        orderBy: { diaPagamento: "asc" },
      });

      const data = alunos.map(a => {
        const pagamento = a.pagamentos.find(p => p.mes === mes && p.ano === ano);
        const pago = pagamento?.pago ?? false;
        const dia = a.diaPagamento!;
        const temAgendamento = a.agendamentos.length > 0;
        let status: string;
        if (pago) {
          status = "pago";
        } else if (!hojeDisponivel && primeiroDia < now) {
          status = "atrasado";
        } else if (hojeDisponivel && now.getDate() >= dia) {
          status = "atrasado";
        } else {
          status = "em_aberto";
        }
        return {
          id: a.id,
          usuario: a.usuario,
          matricula: a.matricula,
          redeSocial: a.redeSocial,
          diaPagamento: dia,
          dataInicioContrato: a.dataInicioContrato,
          dataFimContrato: a.dataFimContrato,
          temAgendamento,
          pago,
          status,
          pagamento: pagamento ? {
            id: pagamento.id,
            valor: pagamento.valor,
            tipoPagamento: pagamento.tipoPagamento,
            pagoEm: pagamento.pagoEm,
            comprovanteUrl: pagamento.comprovanteUrl,
          } : null,
          historicoPagamentos: a.pagamentos.filter(p => p.pago).map(p => ({
            id: p.id,
            mes: p.mes,
            ano: p.ano,
            valor: p.valor,
            tipoPagamento: p.tipoPagamento,
            pagoEm: p.pagoEm,
            comprovanteUrl: p.comprovanteUrl,
          })),
        };
      });

      const alunosComAula = data.filter(a => a.temAgendamento && !a.dataFimContrato);
      const alunosContratoEncerrado = data.filter(a => a.dataFimContrato);

      return res.json({ mes, ano, alunosComAula, alunosContratoEncerrado });
    } catch (error) {
      console.error("Erro ao consultar pagamentos:", error);
      return res.status(500).json({ error: "Erro ao consultar pagamentos" });
    }
  });

  router.post("/pagar", authMiddleware, requireAdminOrProfessor, upload.single("comprovante"), async (req: Request, res: Response) => {
    try {
      const { alunoId, mes: reqMes, ano: reqAno, valor, tipoPagamento } = req.body;
      if (!alunoId) return res.status(400).json({ error: "alunoId é obrigatório" });

      const now = new Date();
      const mes = Number(reqMes) || now.getMonth() + 1;
      const ano = Number(reqAno) || now.getFullYear();

      const aluno = await prisma.aluno.findUnique({
        where: { id: alunoId },
        include: { usuario: true },
      });
      if (!aluno) return res.status(404).json({ error: "Aluno não encontrado" });

      let comprovanteUrl: string | null = null;

      if (r2 && req.file) {
        const ext = req.file.originalname.split(".").pop() ?? "jpg";
        const key = `comprovante/${alunoId}/${ano}-${String(mes).padStart(2, "0")}-${crypto.randomUUID()}.${ext}`;

        await r2.client.send(new PutObjectCommand({
          Bucket: r2.bucket,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        }));

        comprovanteUrl = key;
      }

      const existente = await prisma.pagamento.findUnique({
        where: { alunoId_mes_ano: { alunoId, mes, ano } },
      });

      let pagamento;
      const pagamentoData: Record<string, unknown> = { pago: true, pagoEm: now, comprovanteUrl };
      if (valor != null) pagamentoData.valor = Number(valor);
      if (tipoPagamento) pagamentoData.tipoPagamento = tipoPagamento;
      else pagamentoData.tipoPagamento = "PIX";

      if (existente) {
        if (existente.pago) return res.json(existente);
        pagamento = await prisma.pagamento.update({
          where: { id: existente.id },
          data: pagamentoData as any,
        });
      } else {
        pagamento = await prisma.pagamento.create({
          data: { alunoId, mes, ano, ...pagamentoData } as any,
        });
      }

      return res.status(existente ? 200 : 201).json(pagamento);
    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
      return res.status(500).json({ error: "Erro ao registrar pagamento" });
    }
  });

  router.get("/comprovante/:pagamentoId", async (req, res) => {
    try {
      if (!r2) return res.status(500).json({ error: "Armazenamento não configurado" });

      const pagamentoId = req.params.pagamentoId as string;
      const pagamento = await prisma.pagamento.findUnique({
        where: { id: pagamentoId },
      });

      if (!pagamento?.comprovanteUrl) {
        return res.status(404).json({ error: "Comprovante não encontrado" });
      }

      const command = new GetObjectCommand({
        Bucket: r2.bucket,
        Key: pagamento.comprovanteUrl,
      });

      const response = await r2.client.send(command);
      if (!response.Body) {
        return res.status(404).json({ error: "Arquivo não encontrado no armazenamento" });
      }

      const buffer = await response.Body.transformToByteArray();
      const contentType = response.ContentType ?? "image/jpeg";
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=86400");
      res.end(Buffer.from(buffer));
    } catch (error) {
      console.error("Erro ao buscar comprovante:", error);
      return res.status(500).json({ error: "Erro ao buscar comprovante" });
    }
  });

  return router;
}
