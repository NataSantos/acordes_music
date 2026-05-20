import { PrismaClient } from "../generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

async function main() {
  console.log("Iniciando seed...");

  const salas = [
    { nome: "Sala de Piano", capacidade: 3, descricao: "Piano de cauda e bancos ajustáveis" },
    { nome: "Sala de Violão", capacidade: 6, descricao: "Violões clássicos e fingerboard" },
    { nome: "Sala de Bateria", capacidade: 2, descricao: "Bateria eletrônica e acústica" },
    { nome: "Sala de Canto", capacidade: 8, descricao: "Isolamento acústico e microfones" },
    { nome: "Sala de Teoria", capacidade: 12, descricao: "Quadro branco e projetor" },
  ];

  for (const s of salas) {
    const exists = await prisma.sala.findFirst({ where: { nome: s.nome } });
    if (!exists) {
      await prisma.sala.create({ data: s });
      console.log(`Sala criada: ${s.nome}`);
    } else {
      console.log(`Sala ja existe: ${s.nome}`);
    }
  }

  const professores = [
    { cpf: "11111111111", nome: "Carlos Machado", telefone: "11911111111", email: "carlos@acordes.com", profissao: "Professor de Piano" },
    { cpf: "22222222222", nome: "Ana Silva", telefone: "11922222222", email: "ana@acordes.com", profissao: "Professora de Canto" },
    { cpf: "33333333333", nome: "Pedro Santos", telefone: "11933333333", email: "pedro@acordes.com", profissao: "Professor de Bateria" },
    { cpf: "44444444444", nome: "Mariana Costa", telefone: "11944444444", email: "mariana@acordes.com", profissao: "Professora de Violao" },
    { cpf: "55555555555", nome: "Joao Oliveira", telefone: "11955555555", email: "joao@acordes.com", profissao: "Professor de Teoria Musical" },
  ];

  for (const p of professores) {
    const exists = await prisma.usuario.findFirst({ where: { cpf: p.cpf } });
    if (!exists) {
      await prisma.professor.create({
        data: {
          civil: "Solteiro(a)",
          endereco: "Sao Paulo, SP",
          profissao: p.profissao,
          usuario: {
            create: { cpf: p.cpf, nome: p.nome, telefone: p.telefone, email: p.email, role: "PROFESSOR" },
          },
        },
      });
      console.log(`Professor criado: ${p.nome}`);
    } else {
      console.log(`Professor ja existe: ${p.nome}`);
    }
  }

  const alunos = [
    { cpf: "66666666666", nome: "Lucas Ferreira", telefone: "11966666666", email: "lucas@email.com", matricula: "MAT001" },
    { cpf: "77777777777", nome: "Beatriz Lima", telefone: "11977777777", email: "beatriz@email.com", matricula: "MAT002" },
    { cpf: "88888888888", nome: "Rafael Almeida", telefone: "11988888888", email: "rafael@email.com", matricula: "MAT003" },
    { cpf: "99999999999", nome: "Juliana Martins", telefone: "11999999999", email: "juliana@email.com", matricula: "MAT004" },
    { cpf: "10101010101", nome: "Thiago Barbosa", telefone: "11910101010", email: "thiago@email.com", matricula: "MAT005" },
    { cpf: "12121212121", nome: "Camila Rocha", telefone: "11912121212", email: "camila@email.com", matricula: "MAT006" },
    { cpf: "13131313131", nome: "Gabriel Nunes", telefone: "11913131313", email: "gabriel@email.com", matricula: "MAT007" },
    { cpf: "14141414141", nome: "Larissa Dias", telefone: "11914141414", email: "larissa@email.com", matricula: "MAT008" },
  ];

  for (const a of alunos) {
    const exists = await prisma.usuario.findFirst({ where: { cpf: a.cpf } });
    if (!exists) {
      await prisma.aluno.create({
        data: {
          matricula: a.matricula,
          usuario: {
            create: { cpf: a.cpf, nome: a.nome, telefone: a.telefone, email: a.email, role: "ALUNO" },
          },
        },
      });
      console.log(`Aluno criado: ${a.nome}`);
    } else {
      console.log(`Aluno ja existe: ${a.nome}`);
    }
  }

  console.log("Seed concluido!");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
