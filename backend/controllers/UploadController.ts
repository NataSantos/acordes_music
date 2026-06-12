import { Router } from "express";
import type { Request, Response } from "express";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import { authMiddleware } from "../middleware/auth.js";
import { PrismaClient } from "../generated/client.js";
import crypto from "node:crypto";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Apenas imagens são permitidas"));
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

export default function UploadController(prisma: PrismaClient) {
  const router = Router();

  router.post("/foto", authMiddleware, upload.single("foto"), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Nenhuma imagem enviada" });
      }
      if (!r2) {
        return res.status(500).json({ error: "Armazenamento não configurado" });
      }

      const ext = file.originalname.split(".").pop() ?? "jpg";
      const key = `usuarios/${req.user!.usuarioId}-${crypto.randomUUID()}.${ext}`;

      await r2.client.send(new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));

      await prisma.usuario.update({
        where: { id: req.user!.usuarioId },
        data: { foto: key },
      });

      return res.json({ foto: key });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      return res.status(500).json({ error: "Erro ao fazer upload da imagem" });
    }
  });

  router.get("/foto/:usuarioId", async (req: Request, res: Response) => {
    try {
      if (!r2) {
        return res.status(500).json({ error: "Armazenamento não configurado" });
      }

      const usuario = await prisma.usuario.findUnique({
        where: { id: req.params.usuarioId },
        select: { foto: true },
      });

      if (!usuario?.foto || usuario.foto.includes("://")) {
        return res.status(404).json({ error: "Foto não encontrada" });
      }

      const command = new GetObjectCommand({
        Bucket: r2.bucket,
        Key: usuario.foto,
      });

      const response = await r2.client.send(command);
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      res.set("Content-Type", response.ContentType ?? "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400");
      res.end(buffer);
    } catch (error) {
      console.error("Erro ao buscar foto:", error);
      return res.status(500).json({ error: "Erro ao buscar foto" });
    }
  });

  return router;
}
