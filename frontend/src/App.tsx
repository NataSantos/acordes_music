import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Sala = {
  id: string;
  nome: string;
  capacidade: number;
  descricao?: string | null;
};

type Usuario = {
  id: string;
  cpf: number;
  nome: string;
  telefone: string;
  email: string;
  matricula?: string | null;
  profissao?: string | null;
};

type Professor = {
  id: string;
  usuario: Usuario;
};

type Aluno = {
  id: string;
  usuario: Usuario;
};

type Section = "salas" | "professores" | "alunos";
type Screen = "listing" | "create" | "edit";

const backendUrl = "http://localhost:3000";

function App() {
  const [section, setSection] = useState<Section>("salas");
  const [screen, setScreen] = useState<Screen>("listing");
  const [salas, setSalas] = useState<Sala[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    nome: "",
    descricao: "",
    capacidade: "",
    cpf: "",
    email: "",
    telefone: "",
    profissao: "",
    matricula: "",
  });

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [salasRes, profRes, alunosRes] = await Promise.all([
          fetch(`${backendUrl}/api/salas`),
          fetch(`${backendUrl}/api/professores`),
          fetch(`${backendUrl}/api/alunos`),
        ]);

        if (!salasRes.ok || !profRes.ok || !alunosRes.ok) {
          throw new Error("Falha ao carregar dados do servidor");
        }

        const [salasData, professoresData, alunosData] = await Promise.all([
          salasRes.json(),
          profRes.json(),
          alunosRes.json(),
        ]);

        setSalas(salasData);
        setProfessores(professoresData);
        setAlunos(alunosData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  const activeTitle = useMemo(() => {
    switch (section) {
      case "salas":
        return "Salas";
      case "professores":
        return "Professores";
      case "alunos":
        return "Alunos";
    }
  }, [section]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      nome: "",
      descricao: "",
      capacidade: "",
      cpf: "",
      email: "",
      telefone: "",
      profissao: "",
      matricula: "",
    });
    setMessage(null);
    setError(null);
  };

  const goToListing = () => {
    setScreen("listing");
    resetForm();
  };

  const goToCreate = () => {
    resetForm();
    setScreen("create");
  };

  const goToEdit = (item: Sala | Professor | Aluno) => {
    setMessage(null);
    setError(null);
    setEditingId("id" in item ? item.id : null);

    if (section === "salas") {
      const sala = item as Sala;
      setForm({
        nome: sala.nome,
        descricao: sala.descricao ?? "",
        capacidade: String(sala.capacidade),
        cpf: "",
        email: "",
        telefone: "",
        profissao: "",
        matricula: "",
      });
    } else {
      const usuario = (item as Professor | Aluno).usuario;
      setForm({
        nome: usuario.nome,
        descricao: "",
        capacidade: "",
        cpf: String(usuario.cpf),
        email: usuario.email,
        telefone: usuario.telefone,
        profissao: usuario.profissao ?? "",
        matricula: usuario.matricula ?? "",
      });
    }

    setScreen("edit");
  };

  const handleInput = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    goToListing();
  };

  const refreshSection = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/${section}`);
      if (!response.ok) {
        throw new Error("Falha ao atualizar lista");
      }
      const data = await response.json();
      if (section === "salas") {
        setSalas(data);
      } else if (section === "professores") {
        setProfessores(data);
      } else {
        setAlunos(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const payload: Record<string, unknown> = {};

      if (section === "salas") {
        payload.nome = form.nome;
        payload.capacidade = Number(form.capacidade);
        payload.descricao = form.descricao || null;
      } else if (section === "professores") {
        payload.cpf = Number(form.cpf);
        payload.nome = form.nome;
        payload.telefone = form.telefone;
        payload.email = form.email;
        payload.profissao = form.profissao || null;
      } else {
        payload.cpf = Number(form.cpf);
        payload.nome = form.nome;
        payload.telefone = form.telefone;
        payload.email = form.email;
        payload.matricula = form.matricula || null;
      }

      const method = editingId ? "PUT" : "POST";
      const url = `${backendUrl}/api/${section}${editingId ? `/${editingId}` : ""}`;
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error ||
            `Falha ao ${editingId ? "atualizar" : "cadastrar"} ${activeTitle.slice(0, -1).toLowerCase()}`,
        );
      }

      await refreshSection();
      setMessage(
        `Registro de ${activeTitle.slice(0, -1).toLowerCase()} ${editingId ? "atualizado" : "cadastrado"} com sucesso.`,
      );
      setTimeout(() => {
        goToListing();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${backendUrl}/api/${section}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 204) {
        throw new Error("Falha ao remover registro");
      }
      await refreshSection();
      setMessage(`${activeTitle.slice(0, -1)} removido com sucesso.`);
      goToListing();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const renderList = () => {
    if (loading) {
      return <p>Carregando dados...</p>;
    }

    if (section === "salas") {
      return (
        <>
          <button className="btn-primary-create" onClick={goToCreate}>
            + Nova Sala
          </button>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Capacidade</th>
                <th>Descrição</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {salas.length === 0 ? (
                <tr>
                  <td colSpan={4}>Nenhuma sala cadastrada.</td>
                </tr>
              ) : (
                salas.map((sala) => (
                  <tr key={sala.id}>
                    <td>{sala.nome}</td>
                    <td>{sala.capacidade}</td>
                    <td>{sala.descricao || "-"}</td>
                    <td className="actions-cell">
                      <button onClick={() => goToEdit(sala)}>Editar</button>
                      <button
                        className="danger"
                        onClick={() => handleDelete(sala.id)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      );
    }

    if (section === "professores") {
      return (
        <>
          <button className="btn-primary-create" onClick={goToCreate}>
            + Novo Professor
          </button>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>Profissão</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {professores.length === 0 ? (
                <tr>
                  <td colSpan={5}>Nenhum professor cadastrado.</td>
                </tr>
              ) : (
                professores.map((professor) => (
                  <tr key={professor.id}>
                    <td>{professor.usuario.nome}</td>
                    <td>{professor.usuario.email}</td>
                    <td>{professor.usuario.telefone}</td>
                    <td>{professor.usuario.profissao || "-"}</td>
                    <td className="actions-cell">
                      <button onClick={() => goToEdit(professor)}>
                        Editar
                      </button>
                      <button
                        className="danger"
                        onClick={() => handleDelete(professor.id)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      );
    }

    return (
      <>
        <button className="btn-primary-create" onClick={goToCreate}>
          + Novo Aluno
        </button>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Telefone</th>
              <th>Matrícula</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {alunos.length === 0 ? (
              <tr>
                <td colSpan={5}>Nenhum aluno cadastrado.</td>
              </tr>
            ) : (
              alunos.map((aluno) => (
                <tr key={aluno.id}>
                  <td>{aluno.usuario.nome}</td>
                  <td>{aluno.usuario.email}</td>
                  <td>{aluno.usuario.telefone}</td>
                  <td>{aluno.usuario.matricula || "-"}</td>
                  <td className="actions-cell">
                    <button onClick={() => goToEdit(aluno)}>Editar</button>
                    <button
                      className="danger"
                      onClick={() => handleDelete(aluno.id)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </>
    );
  };

  const renderForm = () => {
    return (
      <form onSubmit={handleSubmit} className="entity-form">
        <label>
          Nome
          <input
            value={form.nome}
            onChange={(event) => handleInput("nome", event.target.value)}
            required
          />
        </label>

        {section === "salas" ? (
          <>
            <label>
              Capacidade
              <input
                type="number"
                min={1}
                value={form.capacidade}
                onChange={(event) =>
                  handleInput("capacidade", event.target.value)
                }
                required
              />
            </label>
            <label>
              Descrição
              <textarea
                value={form.descricao}
                onChange={(event) =>
                  handleInput("descricao", event.target.value)
                }
              />
            </label>
          </>
        ) : (
          <>
            <label>
              CPF
              <input
                type="number"
                value={form.cpf}
                onChange={(event) => handleInput("cpf", event.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleInput("email", event.target.value)}
                required
              />
            </label>
            <label>
              Telefone
              <input
                value={form.telefone}
                onChange={(event) =>
                  handleInput("telefone", event.target.value)
                }
                required
              />
            </label>
            {section === "professores" ? (
              <label>
                Profissão
                <input
                  value={form.profissao}
                  onChange={(event) =>
                    handleInput("profissao", event.target.value)
                  }
                />
              </label>
            ) : (
              <label>
                Matrícula
                <input
                  value={form.matricula}
                  onChange={(event) =>
                    handleInput("matricula", event.target.value)
                  }
                  required
                />
              </label>
            )}
          </>
        )}

        <div className="form-actions">
          <button type="submit">
            {editingId ? "Atualizar" : "Cadastrar"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleCancel}
          >
            Voltar
          </button>
          {editingId && (
            <button
              type="button"
              className="danger"
              onClick={() => handleDelete(editingId)}
            >
              Excluir
            </button>
          )}
        </div>
      </form>
    );
  };

  return (
    <main className="app-container">
      <section className="status-card">
        <div className="header-row">
          <h1>Gerenciamento de Salas, Professores e Alunos</h1>
          <div className="status-pill">Backend: {backendUrl}</div>
        </div>

        <div className="section-tabs">
          {(["salas", "professores", "alunos"] as Section[]).map((item) => (
            <button
              key={item}
              className={item === section ? "active" : ""}
              onClick={() => {
                setSection(item);
                goToListing();
              }}
            >
              {item === "salas"
                ? "Salas"
                : item === "professores"
                  ? "Professores"
                  : "Alunos"}
            </button>
          ))}
        </div>

        <div className="single-panel">
          {screen === "listing" && (
            <div className="grid-panel">
              <div className="panel-header">
                <h2>{activeTitle}</h2>
                <p>Listagem de todos os registros.</p>
              </div>
              {renderList()}
            </div>
          )}

          {screen === "create" && (
            <div className="grid-panel form-panel">
              <div className="panel-header">
                <h2>Cadastrar {activeTitle.slice(0, -1)}</h2>
                <p>Preencha os dados e envie para cadastrar.</p>
              </div>
              {renderForm()}
              {message && <p className="success">{message}</p>}
              {error && <p className="error">{error}</p>}
            </div>
          )}

          {screen === "edit" && (
            <div className="grid-panel form-panel">
              <div className="panel-header">
                <h2>Editar {activeTitle.slice(0, -1)}</h2>
                <p>Atualize os dados ou exclua o registro.</p>
              </div>
              {renderForm()}
              {message && <p className="success">{message}</p>}
              {error && <p className="error">{error}</p>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
