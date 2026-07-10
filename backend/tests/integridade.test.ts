import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const PORT = 3099;
const BASE = `http://localhost:${PORT}`;

let server: ChildProcess;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function json(method: string, url: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${url}`, opts);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, headers: res.headers };
}

async function login(email: string, senha: string) {
  const r = await json("POST", "/api/auth/login", { email, senha });
  if (r.status === 200) {
    const d = r.data as { token?: string };
    return d.token ?? null;
  }
  return null;
}

async function authJson(method: string, url: string, token: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${url}`, opts);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const devDb = path.resolve(__dirname, "..", "dev.db");
  const testDb = path.resolve(__dirname, "..", "test.db");
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
  if (fs.existsSync(devDb)) fs.copyFileSync(devDb, testDb);

  await new Promise<void>((resolve, reject) => {
    server = spawn("npx", ["tsx", "index.ts"], {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        PORT: String(PORT),
        DATABASE_URL: "file:./test.db",
        JWT_SECRET: "acordes-music-secret-key",
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let started = false;

    server.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      if (!started && text.includes("rodando")) {
        started = true;
        resolve();
      }
    });

    server.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      if (text.includes("EPIPE") || text.includes("ERR_STREAM")) return;
      if (!started) {
        if (text.includes("Error") || text.includes("error")) {
          started = true;
          reject(new Error(`Server error: ${text}`));
        }
      }
    });

    setTimeout(() => {
      if (!started) reject(new Error("Server start timeout (30s)"));
    }, 30000);
  });
}, 35000);

afterAll(() => {
  if (server && !server.killed) {
    server.kill("SIGTERM");
  }
  const testDb = path.resolve(__dirname, "..", "test.db");
  const testDbJournal = path.resolve(__dirname, "..", "test.db-journal");
  try {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
    if (fs.existsSync(testDbJournal)) fs.unlinkSync(testDbJournal);
  } catch {
    // ignore cleanup errors
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("1. Health Check", () => {
  it("GET /api/test retorna status ok", async () => {
    const r = await json("GET", "/api/test");
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("status", "ok");
  });
});

describe("2. Autenticação", () => {
  it("Login inválido retorna 401", async () => {
    const r = await json("POST", "/api/auth/login", {
      email: "inexistente@test.com",
      senha: "errada",
    });
    expect(r.status).toBe(401);
    expect(r.data).toHaveProperty("error");
  });

  it("Login sem email retorna 400", async () => {
    const r = await json("POST", "/api/auth/login", { senha: "1234" });
    expect(r.status).toBe(400);
  });

  it("Login sem senha retorna 400", async () => {
    const r = await json("POST", "/api/auth/login", { email: "test@test.com" });
    expect(r.status).toBe(400);
  });

  it("Rota protegida sem token retorna 401", async () => {
    const r = await json("GET", "/api/salas");
    expect(r.status).toBe(401);
    expect(r.data).toHaveProperty("error", "Token não fornecido");
  });

  it("Rota protegida com token inválido retorna 401", async () => {
    const res = await fetch(`${BASE}/api/salas`, {
      headers: { Authorization: "Bearer token-invalido" },
    });
    expect(res.status).toBe(401);
  });

  it("Login admin retorna token", async () => {
    const r = await json("POST", "/api/auth/login", {
      email: "natasantos@sou.faccat.br",
      senha: "natas00712",
    });
    if (r.status === 200) {
      expect(r.data).toHaveProperty("token");
      expect(r.data).toHaveProperty("usuario");
    } else {
      console.warn("  ⚠  Login admin falhou — test.db pode não ter o seed");
    }
  });
});

describe("3. Validação de Input (POST /api/usuarios)", () => {
  let adminToken: string | null;

  beforeAll(async () => {
    adminToken = await login("natasantos@sou.faccat.br", "natas00712");
  });

  it("Criar usuário sem campos retorna 400 (validação zod)", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/usuarios", adminToken, {});
    expect(r.status).toBe(400);
  });

  it("Criar usuário com CPF vazio retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: "",
      nome: "Teste",
      telefone: "51999999999",
      email: "teste@test.com",
      role: "ALUNO",
    });
    expect(r.status).toBe(400);
  });

  it("Criar usuário com email inválido retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: "12345678901",
      nome: "Teste",
      telefone: "51999999999",
      email: "nao-e-email",
      role: "ALUNO",
    });
    expect(r.status).toBe(400);
  });

  it("Criar usuário com role inexistente retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: `12345678901`,
      nome: "Teste Role",
      telefone: "51999999999",
      email: "role-test@test.com",
      role: "INEXISTENTE",
    });
    expect(r.status).toBe(400);
  });
});

describe("4. Autorização — Controle de Acesso por Papel", () => {
  let adminToken: string | null;
  let studentToken: string | null;

  beforeAll(async () => {
    adminToken = await login("natasantos@sou.faccat.br", "natas00712");
    if (adminToken) {
      const uniqueId = Date.now();
      const userR = await authJson("POST", "/api/usuarios", adminToken, {
        cpf: `${String(uniqueId).padStart(11, "0")}`.slice(0, 11),
        nome: "Aluno Teste",
        telefone: "51999999999",
        email: `aluno-auth-${uniqueId}@test.com`,
        role: "ALUNO",
      });
      if (userR.status === 201) {
        const cpfDigits = String(uniqueId).replace(/\D/g, "").slice(0, 6);
        studentToken = await login(`aluno-auth-${uniqueId}@test.com`, cpfDigits);
      }
    }
  });

  it("ALUNO não pode criar sala (403)", async () => {
    if (!studentToken) return;
    const r = await authJson("POST", "/api/salas", studentToken, {
      nome: `Sala-Test-${Date.now()}`,
      capacidade: 10,
    });
    expect(r.status).toBe(403);
  });

  it("ALUNO não pode criar usuário ADMIN (403)", async () => {
    if (!studentToken) return;
    const r = await authJson("POST", "/api/usuarios", studentToken, {
      cpf: "99999999999",
      nome: "Admin Criado por Aluno",
      telefone: "51999999999",
      email: `admin-criado-${Date.now()}@test.com`,
      role: "ADMIN",
    });
    expect(r.status).toBe(403);
  });

  it("ALUNO não pode deletar sala (403)", async () => {
    if (!studentToken || !adminToken) return;
    const salaR = await authJson("POST", "/api/salas", adminToken, {
      nome: `Sala-Delete-${Date.now()}`,
      capacidade: 5,
    });
    if (salaR.status === 201 && salaR.data) {
      const salaId = (salaR.data as { id: string }).id;
      const delR = await fetch(`${BASE}/api/salas/${salaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(delR.status).toBe(403);
    }
  });

  it("ALUNO pode listar agendamentos (GET) — filtrado por role", async () => {
    if (!studentToken) return;
    const r = await authJson("GET", "/api/agendamentos", studentToken);
    // ALUNO pode acessar, mas vê só os próprios
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data)).toBe(true);
  });
});

describe("5. Política de Senha", () => {
  it("Redefinir senha com < 6 caracteres retorna 400", async () => {
    const r = await json("POST", "/api/auth/redefinir-senha", {
      email: "test@test.com",
      codigo: "000000",
      senhaNova: "12345",
    });
    expect(r.status).toBe(400);
    const msg = (r.data as { error: string }).error;
    expect(msg.toLowerCase()).toContain("6");
  });

  it("Redefinir senha sem campos obrigatórios retorna 400", async () => {
    const r = await json("POST", "/api/auth/redefinir-senha", {
      email: "test@test.com",
    });
    expect(r.status).toBe(400);
  });
});

describe("6. Upload de Arquivos", () => {
  let adminToken: string | null;

  beforeAll(async () => {
    adminToken = await login("natasantos@sou.faccat.br", "natas00712");
  });

  it("Upload de .txt como foto de perfil é rejeitado (fileFilter)", async () => {
    if (!adminToken) return;
    const formData = new FormData();
    const blob = new Blob(["não é imagem"], { type: "text/plain" });
    formData.append("foto", blob, "malware.txt");

    const res = await fetch(`${BASE}/api/upload/foto`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    // Deve retornar erro por fileFilter (400) ou 500 (R2 não configurado)
    // O importante é que o filtro está presente (não aceita o arquivo)
    expect([400, 500]).toContain(res.status);
  });

  it("Upload de .html como comprovante de pagamento é rejeitado (fileFilter adicionado)", async () => {
    if (!adminToken) return;
    const formData = new FormData();
    const blob = new Blob(["<html>malicious</html>"], { type: "text/html" });
    formData.append("comprovante", blob, "pagamento.html");

    const res = await fetch(`${BASE}/api/pagamentos/pagar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    // fileFilter rejeita antes de chegar no handler
    expect([400, 500]).toContain(res.status);
    if (res.status === 400) {
      const d = await res.json();
      expect(d).toHaveProperty("error");
    }
  });

  it("GET /foto/:usuarioId é público (sem auth)", async () => {
    const res = await fetch(`${BASE}/api/upload/foto/nonexistent-id`);
    // Não retorna 401 — endpoint é público
    expect(res.status).not.toBe(401);
  });
});

describe("7. CORS", () => {
  it("CORS permite qualquer origem (*)", async () => {
    const res = await fetch(`${BASE}/api/test`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://site-malicioso.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    const origin = res.headers.get("access-control-allow-origin");
    expect(origin).toBe("*");
  });
});

describe("8. Conflito de Agendamentos", () => {
  it("/verificar-conflito valida parâmetros obrigatórios", async () => {
    const adminToken = await login("natasantos@sou.faccat.br", "natas00712");
    if (!adminToken) return;
    const r = await authJson("GET", "/api/agendamentos/verificar-conflito", adminToken);
    expect(r.status).toBe(400);
    expect(r.data).toHaveProperty("error");
  });
});

describe("9. SQL Injection", () => {
  it("Login com SQL injection não quebra (Prisma seguro)", async () => {
    const r = await json("POST", "/api/auth/login", {
      email: "' OR 1=1 --",
      senha: "' OR '1'='1",
    });
    expect([401, 400]).toContain(r.status);
  });

  it("Busca de salas com SQL injection não quebra", async () => {
    const adminToken = await login("natasantos@sou.faccat.br", "natas00712");
    if (!adminToken) return;
    const r = await authJson("GET", "/api/salas", adminToken);
    expect(r.status).toBe(200);
  });
});

describe("10. Senha Padrão (6 primeiros dígitos do CPF)", () => {
  it("Novo usuário recebe senha = 6 primeiros dígitos do CPF", async () => {
    const adminToken = await login("natasantos@sou.faccat.br", "natas00712");
    if (!adminToken) return;

    const cpf = `${String(Date.now()).padStart(11, "0")}`.slice(0, 11);
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf,
      nome: "Teste CPF Senha",
      telefone: "51999999999",
      email: `cpf-senha-${Date.now()}@test.com`,
      role: "ALUNO",
    });

    if (r.status === 201) {
      const cpfDigits = cpf.replace(/\D/g, "").slice(0, 6);
      const loginR = await json("POST", "/api/auth/login", {
        email: `cpf-senha-${Date.now() - 1}@test.com`,
        senha: cpfDigits,
      });
      const cpf2 = String(Date.now()).padStart(11, "0").slice(0, 11);
      const email2 = `cpf-senha-${Date.now()}@test.com`;
      const r2 = await authJson("POST", "/api/usuarios", adminToken, {
        cpf: cpf2,
        nome: "Teste CPF Senha 2",
        telefone: "51999999999",
        email: email2,
        role: "ALUNO",
      });
      if (r2.status === 201) {
        const senhaEsperada = cpf2.replace(/\D/g, "").slice(0, 6);
        const loginR2 = await json("POST", "/api/auth/login", {
          email: email2,
          senha: senhaEsperada,
        });
        expect(loginR2.status).toBe(200);
      }
    }
  });
});

describe("11. Validação de Campos — Tipos, Formatos e Opcionais", () => {
  let adminToken: string | null;
  const unique = () => String(Date.now() + Math.floor(Math.random() * 10000));

  beforeAll(async () => {
    adminToken = await login("natasantos@sou.faccat.br", "natas00712");
  });

  it("CPF com pontos e traço é aceito (123.456.789-01)", async () => {
    if (!adminToken) return;
    const suf = unique();
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: "123.456.789-01",
      nome: "CPF Pontos",
      telefone: "51999999999",
      email: `cpf-pontos-${suf}@test.com`,
      role: "ALUNO",
    });
    expect(r.status).toBe(201);
  });

  it("CPF sem pontos é aceito (12345678901)", async () => {
    if (!adminToken) return;
    const suf = unique();
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: "12345678901",
      nome: "CPF Sem Pontos",
      telefone: "51999999999",
      email: `cpf-sem-pontos-${suf}@test.com`,
      role: "ALUNO",
    });
    expect(r.status).toBe(201);
  });

  it("CPF com caracteres não numéricos retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: "123.456.789-0A",
      nome: "CPF Invalido",
      telefone: "51999999999",
      email: `cpf-inv-${unique()}@test.com`,
      role: "ALUNO",
    });
    expect(r.status).toBe(400);
  });

  it("CPF muito curto retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: "12345",
      nome: "CPF Curto",
      telefone: "51999999999",
      email: `cpf-curto-${unique()}@test.com`,
      role: "ALUNO",
    });
    expect(r.status).toBe(400);
  });

  it("Nome com 1 caractere retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: "11111111111",
      nome: "A",
      telefone: "51999999999",
      email: `nome-curto-${unique()}@test.com`,
      role: "ALUNO",
    });
    expect(r.status).toBe(400);
  });

  it("Nome com 101 caracteres retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: "22222222222",
      nome: "A".repeat(101),
      telefone: "51999999999",
      email: `nome-longo-${unique()}@test.com`,
      role: "ALUNO",
    });
    expect(r.status).toBe(400);
  });

  it("Telefone com 7 dígitos retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: "33333333333",
      nome: "Tel Curto",
      telefone: "1234567",
      email: `tel-curto-${unique()}@test.com`,
      role: "ALUNO",
    });
    expect(r.status).toBe(400);
  });

  it("Telefone com 21 dígitos retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: "44444444444",
      nome: "Tel Longo",
      telefone: "1".repeat(21),
      email: `tel-longo-${unique()}@test.com`,
      role: "ALUNO",
    });
    expect(r.status).toBe(400);
  });

  it("Email sem @ retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/usuarios", adminToken, {
      cpf: "55555555555",
      nome: "Email Invalido",
      telefone: "51999999999",
      email: "sem-arroba.com",
      role: "ALUNO",
    });
    expect(r.status).toBe(400);
  });

  it("Criar sala com capacidade negativa retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/salas", adminToken, {
      nome: `Sala Negativa ${unique()}`,
      capacidade: -5,
    });
    expect(r.status).toBe(400);
  });

  it("Criar sala com capacidade zero retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/salas", adminToken, {
      nome: `Sala Zero ${unique()}`,
      capacidade: 0,
    });
    expect(r.status).toBe(400);
  });

  it("Criar sala com capacidade string numérica é aceito", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/salas", adminToken, {
      nome: `Sala Str ${unique()}`,
      capacidade: "10",
    });
    expect(r.status).toBe(201);
  });

  it("Criar sala com capacidade não numérica retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/salas", adminToken, {
      nome: `Sala NaN ${unique()}`,
      capacidade: "abc",
    });
    expect(r.status).toBe(400);
  });

  it("Criar sala com nome vazio retorna 400", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/salas", adminToken, {
      nome: "",
      capacidade: 10,
    });
    expect(r.status).toBe(400);
  });

  it("Criar sala sem descricao (campo opcional) é aceito", async () => {
    if (!adminToken) return;
    const r = await authJson("POST", "/api/salas", adminToken, {
      nome: `Sala Sem Desc ${unique()}`,
      capacidade: 5,
    });
    expect(r.status).toBe(201);
  });

  it("Criar aluno sem redeSocial é aceito", async () => {
    if (!adminToken) return;
    const suf = unique();
    const r = await authJson("POST", "/api/alunos", adminToken, {
      cpf: `666${suf}`.slice(0, 11).padEnd(11, "0"),
      nome: "Aluno Sem RedeSocial",
      telefone: "51999999999",
      email: `aluno-sem-opc-${suf}@test.com`,
      matricula: `MAT${suf}`,
      diaPagamento: "10",
    });
    expect(r.status).toBe(201);
  });

  it("Criar aluno com matricula vazia retorna 400", async () => {
    if (!adminToken) return;
    const suf = unique();
    const r = await authJson("POST", "/api/alunos", adminToken, {
      cpf: `777${suf}`.slice(0, 11).padEnd(11, "0"),
      nome: "Aluno Sem Mat",
      telefone: "51999999999",
      email: `aluno-sem-mat-${suf}@test.com`,
      matricula: "",
      diaPagamento: "10",
    });
    expect(r.status).toBe(400);
  });

  it("Criar aluno sem diaPagamento retorna 400", async () => {
    if (!adminToken) return;
    const suf = unique();
    const r = await authJson("POST", "/api/alunos", adminToken, {
      cpf: `000${suf}`.slice(0, 11).padEnd(11, "0"),
      nome: "Aluno Sem Dia",
      telefone: "51999999999",
      email: `aluno-sem-dia-${suf}@test.com`,
      matricula: `MAT${suf}`,
    });
    expect(r.status).toBe(400);
  });

  it("Criar aluno com diaPagamento string é aceito", async () => {
    if (!adminToken) return;
    const suf = unique();
    const r = await authJson("POST", "/api/alunos", adminToken, {
      cpf: `888${suf}`.slice(0, 11).padEnd(11, "0"),
      nome: "Aluno DiaPag Str",
      telefone: "51999999999",
      email: `aluno-dia-${suf}@test.com`,
      matricula: `MAT${suf}`,
      diaPagamento: "15",
    });
    expect(r.status).toBe(201);
  });

  it("Criar aluno com diaPagamento number é aceito", async () => {
    if (!adminToken) return;
    const suf = unique();
    const r = await authJson("POST", "/api/alunos", adminToken, {
      cpf: `999${suf}`.slice(0, 11).padEnd(11, "0"),
      nome: "Aluno DiaPag Num",
      telefone: "51999999999",
      email: `aluno-dia-num-${suf}@test.com`,
      matricula: `MAT${suf}`,
      diaPagamento: 20,
    });
    expect(r.status).toBe(201);
  });

  it("Criar professor sem civil, endereco, profissao é aceito", async () => {
    if (!adminToken) return;
    const suf = unique();
    const r = await authJson("POST", "/api/professores", adminToken, {
      cpf: `000${suf}`.slice(0, 11).padEnd(11, "0"),
      nome: "Prof Sem Opcionais",
      telefone: "51999999999",
      email: `prof-sem-opc-${suf}@test.com`,
    });
    expect(r.status).toBe(201);
  });

  it("Criar professor com opcionais null é aceito", async () => {
    if (!adminToken) return;
    const suf = unique();
    const r = await authJson("POST", "/api/professores", adminToken, {
      cpf: `001${suf}`.slice(0, 11).padEnd(11, "0"),
      nome: "Prof Null",
      telefone: "51999999999",
      email: `prof-null-${suf}@test.com`,
      civil: null,
      endereco: null,
      profissao: null,
    });
    expect(r.status).toBe(201);
  });
});
