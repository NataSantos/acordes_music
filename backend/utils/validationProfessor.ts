import { z } from "zod";
import { usuarioSchema } from "./validation.js";

export const professorCreateSchema = z.object({
  cpf: usuarioSchema.shape.cpf,
  nome: usuarioSchema.shape.nome,
  telefone: usuarioSchema.shape.telefone,
  email: usuarioSchema.shape.email,
  civil: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  profissao: z.string().nullable().optional(),
});
