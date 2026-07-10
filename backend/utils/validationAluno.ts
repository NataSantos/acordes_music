import { z } from "zod";
import { usuarioSchema } from "./validation.js";

export const alunoCreateSchema = z.object({
  cpf: usuarioSchema.shape.cpf,
  nome: usuarioSchema.shape.nome,
  telefone: usuarioSchema.shape.telefone,
  email: usuarioSchema.shape.email,
  matricula: z.string({ message: "Matrícula é obrigatória" }).min(1, "Matrícula não pode estar vazia"),
  redeSocial: z.string().nullable().optional(),
  diaPagamento: z.union([z.string(), z.number()], { message: "Dia de pagamento é obrigatório" }),
  dataInicioContrato: z.string().nullable().optional(),
  dataFimContrato: z.string().nullable().optional(),
});
