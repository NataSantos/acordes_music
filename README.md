# Acordes Music

Sistema web de gestão para escolas de música. A aplicação centraliza o cadastro de salas, professores e alunos, o agendamento de aulas, o registro de aulas concluídas e os processos financeiros da escola.

O projeto está organizado em duas aplicações independentes: um backend responsável pela API, pelas regras de negócio e pela persistência dos dados, e um frontend responsável pela interface do usuário.

## Sumário

1. Funcionalidades
2. Tecnologias utilizadas
3. Estrutura do repositório
4. Pré-requisitos
5. Configuração do backend
6. Banco de dados e dados iniciais
7. Execução da aplicação
8. Conta inicial
9. Fluxo de uso
10. Papéis e permissões
11. Rotas principais da API
12. Testes, lint, build e backup
13. Publicação no GitHub

## 1. Funcionalidades

### 1.1 Cadastros

- Cadastro de salas, com nome, capacidade e descrição.
- Cadastro de usuários com CPF, nome, telefone, e-mail, senha e perfil de acesso.
- Cadastro de professores e alunos vinculados a um usuário.
- No cadastro de alunos, são registrados matrícula, rede social, dia de pagamento e vigência do contrato.
- A senha inicial dos usuários é definida pelo sistema no momento do cadastro e deve ser alterada no primeiro acesso.

### 1.2 Agendamento de aulas

- Criação, edição e exclusão de agendamentos com data, horário, duração, sala, professor, aluno, valor e observação.
- Verificação automática de conflitos de horário para professor, aluno e sala antes de salvar.
- Verificação de conflitos em tempo real no formulário de agendamento.
- Repetição semanal configurável, com padrão de doze semanas.
- Valor padrão de R$ 240,00 por aula e valor zero para aula experimental.
- Registro de aula concluída, com alteração do status de `AGENDADO` para `CONCLUIDO`.
- Filtros por status, sala, professor e período.

### 1.3 Financeiro

- Cálculo de ganhos da escola e dos professores, com retenção de 30% para a escola e repasse de 70% ao professor.
- Resumo com valor bruto, líquido da escola, líquido dos professores, total de aulas, total de horas e agrupamentos por professor e por mês.
- Controle de recebimentos mensais dos alunos, com situações de pago, atrasado e em aberto.
- Registro de pagamentos de alunos e de professores, com tipo de pagamento e comprovante em imagem.
- Relatório geral de pagamentos de professores em HTML, com opção de impressão.

### 1.4 Acesso e perfil

- Autenticação por e-mail e senha com token JWT válido por 24 horas.
- Recuperação de senha por código de seis dígitos enviado por e-mail, com validade de 15 minutos.
- Alteração de senha do usuário autenticado.
- Atualização dos dados do perfil.
- Upload e recorte de foto de perfil.

## 2. Tecnologias utilizadas

### Backend

- Node.js com TypeScript e módulos ESM.
- Express 5 para a camada HTTP.
- Prisma 7 com adaptador `better-sqlite3` e banco de dados SQLite.
- JSON Web Token para autenticação.
- bcryptjs para hashing de senhas.
- Zod para validação das entradas.
- Multer para recebimento de arquivos.
- Nodemailer para envio de e-mails.
- AWS SDK para integração com o armazenamento de objetos Cloudflare R2.
- Vitest e Supertest para os testes automatizados.

### Frontend

- React 19 e Vite 8.
- TypeScript.
- Tailwind CSS 4.
- Shadcn/ui como padrão de construção dos componentes de interface, sobre Radix UI e Tailwind CSS.
- Lucide React para ícones.
- React Easy Crop para recorte de imagens.
- date-fns e React Day Picker para manipulação de datas.
- Input OTP para o código de recuperação de senha.

## 3. Estrutura do repositório

```text
acordes_music-main/
├── backend/
│   ├── controllers/            # Controladores das rotas da API
│   ├── generated/              # Cliente Prisma gerado
│   ├── lib/                    # Integrações auxiliares, como e-mail
│   ├── middleware/             # Autenticação e controle de papéis
│   ├── prisma/
│   │   ├── migrations/         # Migrações do banco de dados
│   │   ├── schema.prisma       # Modelo de dados
│   │   └── seed.ts             # Dados iniciais
│   ├── tests/                  # Testes de integração
│   ├── utils/                  # Esquemas de validação
│   ├── index.ts                # Ponto de entrada da API
│   ├── .env.example            # Exemplo de variáveis de ambiente
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/ui/      # Componentes shadcn/ui reutilizáveis
│   │   ├── lib/                # Utilitários
│   │   ├── App.tsx             # Telas e regras da interface
│   │   ├── index.css           # Estilos globais
│   │   └── main.tsx            # Ponto de entrada da aplicação
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── backup.ps1
├── check_dups.py
├── check_users.mjs
└── get_conflicting.py
```

Os arquivos na raiz são utilitários de apoio ao desenvolvimento. O script `backup.ps1` realiza cópia do banco de dados e pode ser executado pelo backend com `npm run backup`.

## 4. Pré-requisitos

- Node.js versão 20.19 ou superior. Recomenda-se o Node.js 22 LTS.
- npm instalado junto com o Node.js.
- PowerShell, necessário apenas para o script de backup.
- Opcional: servidor SMTP para o envio de e-mails de recuperação de senha.
- Opcional: conta e bucket Cloudflare R2 para armazenamento de fotos e comprovantes.

Sem as configurações de SMTP, o código de recuperação é exibido no console do backend. Sem as configurações de R2, as funcionalidades de upload retornam erro de armazenamento não configurado.

## 5. Configuração do backend

No diretório `backend`, instale as dependências e crie o arquivo de variáveis de ambiente:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edite o arquivo `.env` conforme o ambiente. As variáveis disponíveis são:

| Variável | Finalidade | Valor de exemplo |
|---|---|---|
| `DATABASE_URL` | Localização do banco SQLite | `file:./dev.db` |
| `JWT_SECRET` | Chave secreta usada na assinatura dos tokens | valor aleatório definido pelo responsável pela implantação |
| `PORT` | Porta da API, quando não informada usa 3000 | `3000` |
| `SMTP_HOST` | Servidor SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Porta do servidor SMTP | `587` |
| `SMTP_USER` | Usuário do SMTP | `email@exemplo.com` |
| `SMTP_PASS` | Senha de aplicativo do SMTP | definida pelo proprietário da conta |
| `SMTP_FROM` | Remetente dos e-mails | `email@exemplo.com` |
| `APP_NAME` | Nome exibido nos e-mails | `Acordes Music` |
| `R2_ACCOUNT_ID` | Identificador da conta Cloudflare | valor da conta |
| `R2_BUCKET` | Nome do bucket | `nome-do-bucket` |
| `R2_ACCESS_KEY` | Chave de acesso do bucket | valor da chave |
| `R2_SECRET_KEY` | Chave secreta do bucket | valor da chave |

As variáveis de e-mail e de armazenamento já vêm comentadas no arquivo `.env.example` e devem ser descomentadas apenas quando forem utilizadas. O valor de `JWT_SECRET` presente no arquivo de exemplo deve ser substituído por um valor aleatório antes de qualquer implantação. Chaves, senhas e credenciais não devem ser divulgadas na documentação nem incluídas no controle de versão.

## 6. Banco de dados e dados iniciais

Ainda no diretório `backend`, aplique as migrações, gere o cliente Prisma e carregue os dados iniciais:

```powershell
npx prisma migrate deploy
npx prisma generate
npx tsx prisma/seed.ts
```

O seed cria a conta de administrador, cinco salas, cinco professores e oito alunos. Ele pode ser executado novamente em um banco vazio. Para reiniciar o banco do zero, remova o arquivo `dev.db` e execute novamente os comandos acima.

As credenciais da conta de administrador são definidas no arquivo `backend/prisma/seed.ts`. Em ambientes que não sejam de desenvolvimento, substitua esses valores por variáveis de ambiente antes de executar o seed, e altere a senha no primeiro acesso.

O modelo de dados é composto pelas entidades `Usuario`, `Professor`, `Aluno`, `Sala`, `Agendamento`, `Pagamento` e `PagamentoProfessor`, além dos enums `Role` e `AgendamentoStatus`.

## 7. Execução da aplicação

Abra dois terminais. No primeiro, inicie o backend:

```powershell
cd backend
npm run dev
```

A API ficará disponível em `http://localhost:3000`. Para verificar se está funcionando, acesse `http://localhost:3000/api/test`. A resposta esperada é:

```json
{ "status": "ok", "message": "Backend funcionando" }
```

No segundo terminal, inicie o frontend:

```powershell
cd frontend
npm install
npm run dev
```

A interface ficará disponível em `http://localhost:5173`. Por padrão, o frontend utiliza o host atual com a porta 3000 para acessar a API. Caso a API esteja em outro endereço, crie o arquivo `frontend/.env.local` com o conteúdo abaixo antes de iniciar o frontend:

```text
VITE_API_URL=http://localhost:3000
```

## 8. Conta inicial

Após executar o seed, a conta de administrador é criada com os dados definidos no arquivo `backend/prisma/seed.ts`. Consulte esse arquivo para obter as credenciais iniciais e altere a senha no primeiro acesso.

Para os demais usuários, a senha inicial é definida pelo sistema no momento do cadastro e deve ser alterada no primeiro acesso. Em caso de dúvida, solicite a credencial ao administrador da escola.

## 9. Fluxo de uso

1. Acesse `http://localhost:5173` e faça login com uma conta de administrador.
2. Em `Salas`, cadastre os ambientes disponíveis para as aulas.
3. Em `Professores`, cadastre os professores da escola.
4. Em `Alunos`, cadastre os alunos, informando matrícula, dia de pagamento e vigência do contrato.
5. Em `Agendamentos`, crie as aulas. O formulário verifica conflitos de professor, aluno e sala antes de salvar.
6. Após a aula, utilize a ação de registrar para marcá-la como concluída.
7. Em `Financeiro`, acompanhe os ganhos da escola e dos professores, com filtro por período.
8. Em `Recebimentos`, registre o pagamento mensal dos alunos e anexe o comprovante quando necessário.
9. Em `Pagamento`, registre o repasse mensal aos professores.
10. Utilize o botão `Relatório Geral` para gerar o relatório de pagamentos de professores e imprimi-lo.

A navegação lateral exibe somente as seções permitidas para o perfil do usuário autenticado.

## 10. Papéis e permissões

| Perfil | Permissões principais |
|---|---|
| ADMIN | Acesso a todas as seções: salas, usuários, professores, alunos, agendamentos, financeiro, recebimentos e pagamentos. Pode criar, editar e excluir registros, emitir relatórios e registrar pagamentos. |
| PROFESSOR | Acesso a professores, alunos, agendamentos e financeiro. Visualiza os próprios agendamentos e ganhos, cria e edita aulas, registra aulas concluídas e consulta os próprios pagamentos. |
| ALUNO | Acesso à seção de agendamentos, com visualização limitada às próprias aulas. |

As rotas de criação e exclusão de salas, usuários, professores e alunos são restritas ao administrador. A criação e a edição de agendamentos são permitidas a administradores e professores.

## 11. Rotas principais da API

Todas as rotas abaixo exigem o cabeçalho `Authorization: Bearer <token>`, exceto as rotas de login e recuperação de senha, o teste de health check, as fotos de perfil e os comprovantes.

### Autenticação

| Método | Rota | Finalidade |
|---|---|---|
| POST | `/api/auth/login` | Realiza login e retorna o token |
| POST | `/api/auth/solicitar-codigo` | Envia o código de recuperação de senha |
| POST | `/api/auth/verificar-codigo` | Valida o código informado |
| POST | `/api/auth/redefinir-senha` | Define uma nova senha |
| PUT | `/api/auth/senha` | Altera a senha do usuário autenticado |
| GET | `/api/auth/me` | Retorna o perfil do usuário autenticado |
| PUT | `/api/auth/me` | Atualiza os dados do perfil |

### Cadastros

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/salas` | Lista salas |
| POST | `/api/salas` | Cria uma sala |
| PUT | `/api/salas/:id` | Atualiza uma sala |
| DELETE | `/api/salas/:id` | Exclui uma sala sem agendamentos vinculados |
| GET | `/api/usuarios` | Lista usuários |
| POST | `/api/usuarios` | Cria um usuário |
| PUT | `/api/usuarios/:id` | Atualiza um usuário |
| DELETE | `/api/usuarios/:id` | Exclui um usuário sem perfil vinculado |
| GET | `/api/professores` | Lista professores |
| POST | `/api/professores` | Cria um professor e seu usuário |
| PUT | `/api/professores/:id` | Atualiza um professor |
| DELETE | `/api/professores/:id` | Exclui um professor e seus vínculos |
| GET | `/api/alunos` | Lista alunos |
| POST | `/api/alunos` | Cria um aluno e seu usuário |
| PUT | `/api/alunos/:id` | Atualiza um aluno |
| DELETE | `/api/alunos/:id` | Exclui um aluno e seus vínculos |

### Agendamentos

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/agendamentos` | Lista agendamentos conforme o perfil |
| GET | `/api/agendamentos/verificar-conflito` | Verifica conflitos de horário |
| GET | `/api/agendamentos/:id` | Busca um agendamento |
| POST | `/api/agendamentos` | Cria um agendamento |
| PUT | `/api/agendamentos/:id` | Atualiza um agendamento |
| DELETE | `/api/agendamentos/:id` | Exclui um agendamento |
| PATCH | `/api/agendamentos/:id/registrar` | Marca a aula como concluída |

### Financeiro e arquivos

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/ganhos` | Retorna o resumo de ganhos com filtros |
| GET | `/api/pagamentos` | Lista os pagamentos dos alunos por mês e ano |
| POST | `/api/pagamentos/pagar` | Registra o pagamento de um aluno |
| GET | `/api/pagamentos/comprovante/:pagamentoId` | Retorna o comprovante do aluno |
| GET | `/api/pagamentos-professor` | Lista os pagamentos dos professores |
| POST | `/api/pagamentos-professor/pagar` | Registra o pagamento de um professor |
| GET | `/api/pagamentos-professor/comprovante/:pagamentoId` | Retorna o comprovante do professor |
| GET | `/api/pagamentos-professor/relatorio` | Gera o relatório geral em HTML |
| POST | `/api/upload/foto` | Envia a foto de perfil |
| GET | `/api/upload/foto/:usuarioId` | Retorna a foto de perfil |

## 12. Testes, lint, build e backup

Para executar os testes de integração do backend:

```powershell
cd backend
npm test
```

Os testes utilizam Vitest e Supertest, criam uma cópia temporária do banco em `test.db` e iniciam a API em uma porta dedicada. As suítes cobrem health check, autenticação, validação de entradas, autorização por perfil, upload, CORS, conflitos de agendamento, injeção de SQL, senha inicial e exclusão com vínculos.

Para verificar e gerar o frontend:

```powershell
cd frontend
npm run lint
npm run build
npm run preview
```

O comando `npm run build` executa a verificação de tipos com TypeScript e gera os arquivos de produção na pasta `dist`. O comando `npm run preview` serve localmente o resultado do build.

Para realizar o backup manual do banco de dados:

```powershell
cd backend
npm run backup
```

O script copia o arquivo `dev.db` para a pasta `Backup Acordes` dentro do Google Drive do usuário, com o nome contendo a data e a hora da cópia.
