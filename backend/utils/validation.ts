import { z } from "zod";

const ptBrErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === "invalid_type") {
    if (issue.received === "undefined") return { message: "Campo é obrigatório" };
    if (issue.received === "null") return { message: "Campo não pode ser nulo" };
    if (issue.expected === "string") return { message: "Valor deve ser um texto" };
    if (issue.expected === "number" || issue.expected === "integer") return { message: "Valor deve ser um número" };
    return { message: "Tipo inválido" };
  }
  if (issue.code === "invalid_string") {
    if (issue.validation === "email") return { message: "Formato de email inválido" };
    if (issue.validation === "uuid") return { message: "ID inválido" };
    return { message: "Formato inválido" };
  }
  if (issue.code === "too_small") {
    if (issue.type === "string") return { message: `Deve ter no mínimo ${issue.minimum} caracteres` };
    if (issue.type === "number") return { message: `Deve ser no mínimo ${issue.minimum}` };
    return { message: "Valor abaixo do mínimo permitido" };
  }
  if (issue.code === "too_big") {
    if (issue.type === "string") return { message: `Deve ter no máximo ${issue.maximum} caracteres` };
    if (issue.type === "number") return { message: `Deve ser no máximo ${issue.maximum}` };
    return { message: "Valor acima do máximo permitido" };
  }
  if (issue.code === "invalid_enum_value") {
    return { message: `Valor inválido. Opções: ${issue.options.join(", ")}` };
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(ptBrErrorMap);

export const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

export const usuarioSchema = z.object({
  cpf: z
    .string({ message: "CPF é obrigatório" })
    .min(11, "CPF deve ter no mínimo 11 dígitos")
    .regex(cpfRegex, "Formato de CPF inválido"),
  nome: z
    .string({ message: "Nome é obrigatório" })
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  telefone: z
    .string({ message: "Telefone é obrigatório" })
    .min(8, "Telefone deve ter no mínimo 8 dígitos")
    .max(20, "Telefone deve ter no máximo 20 caracteres"),
  email: z
    .string({ message: "Email é obrigatório" })
    .email("Formato de email inválido"),
  role: z
    .enum(["ADMIN", "PROFESSOR", "ALUNO"], { message: "Role deve ser ADMIN, PROFESSOR ou ALUNO" }),
  permissions: z.string().optional(),
});

export const salaSchema = z.object({
  nome: z
    .string({ message: "Nome da sala é obrigatório" })
    .min(1, "Nome da sala não pode estar vazio")
    .max(100, "Nome da sala deve ter no máximo 100 caracteres"),
  capacidade: z
    .union([z.string(), z.number()], { message: "Capacidade é obrigatória" })
    .transform((v) => Number(v))
    .pipe(z.number().int("Capacidade deve ser um número inteiro").positive("Capacidade deve ser maior que zero")),
  descricao: z.string().nullable().optional(),
});

export const agendamentoSchema = z.object({
  professorId: z.string({ message: "Professor é obrigatório" }).uuid("ID do professor inválido"),
  alunoId: z.string({ message: "Aluno é obrigatório" }).uuid("ID do aluno inválido"),
  salaId: z.string({ message: "Sala é obrigatória" }).uuid("ID da sala inválido"),
  data: z.string({ message: "Data é obrigatória" }).min(1, "Data não pode estar vazia"),
  horario: z
    .string({ message: "Horário é obrigatório" })
    .regex(/^\d{2}:\d{2}$/, "Horário deve estar no formato HH:MM"),
  duracao: z
    .union([z.string(), z.number()], { message: "Duração é obrigatória" })
    .transform((v) => Number(v))
    .pipe(z.number().int("Duração deve ser um número inteiro").positive("Duração deve ser maior que zero")),
  valor: z.union([
    z.string().transform(v => Number(v.replace(",", "."))).pipe(z.number({ message: "Valor deve ser um número" }).nonnegative("Valor não pode ser negativo")),
    z.number().nonnegative("Valor não pode ser negativo"),
  ]).nullable().optional(),
  observacao: z.string().max(500, "Observação deve ter no máximo 500 caracteres").nullable().optional(),
});

export const passwordResetSchema = z.object({
  email: z.string({ message: "Email é obrigatório" }).email("Email inválido"),
  codigo: z.string({ message: "Código é obrigatório" }).min(6, "Código deve ter 6 dígitos"),
  senhaNova: z
    .string({ message: "Nova senha é obrigatória" })
    .min(6, "A nova senha deve ter no mínimo 6 caracteres"),
});

export const passwordChangeSchema = z.object({
  senhaAtual: z.string({ message: "Senha atual é obrigatória" }),
  senhaNova: z
    .string({ message: "Nova senha é obrigatória" })
    .min(6, "A nova senha deve ter no mínimo 6 caracteres"),
});

export function extrairErros(error: z.ZodError): string[] {
  return error.issues.map((e: { message: string }) => e.message);
}

export function extrairPrimeiroErro(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Erro de validação";
}
