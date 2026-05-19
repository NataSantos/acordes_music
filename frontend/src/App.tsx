import { useEffect, useState } from "react";
import "./App.css";

type Sala = { id: string; nome: string; capacidade: number; descricao?: string | null };
type Usuario = { id: string; cpf: string; nome: string; telefone: string; email: string };
type Professor = { id: string; usuario: Usuario; profissao?: string | null };
type Aluno = { id: string; usuario: Usuario; matricula?: string | null };

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
  const [form, setForm] = useState({ nome: "", descricao: "", capacidade: "", cpf: "", email: "", telefone: "", profissao: "", matricula: "" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [a, b, c] = await Promise.all([
          fetch(`${backendUrl}/api/salas`),
          fetch(`${backendUrl}/api/professores`),
          fetch(`${backendUrl}/api/alunos`),
        ]);
        if (!a.ok || !b.ok || !c.ok) throw new Error("Falha ao carregar");
        const [sd, pd, ad] = await Promise.all([a.json(), b.json(), c.json()]);
        setSalas(sd); setProfessores(pd); setAlunos(ad);
      } catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
      finally { setLoading(false); }
    })();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({ nome: "", descricao: "", capacidade: "", cpf: "", email: "", telefone: "", profissao: "", matricula: "" });
    setMessage(null); setError(null);
  };

  const goToListing = () => { setScreen("listing"); resetForm(); };

  const goToEdit = (item: Sala | Professor | Aluno) => {
    setEditingId(item.id);
    if (section === "salas") {
      const s = item as Sala;
      setForm({ nome: s.nome, descricao: s.descricao ?? "", capacidade: String(s.capacidade), cpf: "", email: "", telefone: "", profissao: "", matricula: "" });
    } else if (section === "professores") {
      const p = item as Professor;
      setForm({ nome: p.usuario.nome, descricao: "", capacidade: "", cpf: p.usuario.cpf, email: p.usuario.email, telefone: p.usuario.telefone, profissao: p.profissao ?? "", matricula: "" });
    } else {
      const a = item as Aluno;
      setForm({ nome: a.usuario.nome, descricao: "", capacidade: "", cpf: a.usuario.cpf, email: a.usuario.email, telefone: a.usuario.telefone, profissao: "", matricula: a.matricula ?? "" });
    }
    setScreen("edit");
  };

  const handleInput = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  const refreshSection = async () => {
    const r = await fetch(`${backendUrl}/api/${section}`);
    const data = await r.json();
    if (section === "salas") setSalas(data);
    else if (section === "professores") setProfessores(data);
    else setAlunos(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setMessage(null);
    try {
      const payload: Record<string, unknown> = {};
      if (section === "salas") {
        payload.nome = form.nome; payload.capacidade = Number(form.capacidade); payload.descricao = form.descricao || null;
      } else if (section === "professores") {
        payload.cpf = form.cpf; payload.nome = form.nome; payload.telefone = form.telefone; payload.email = form.email; payload.profissao = form.profissao || null;
      } else {
        payload.cpf = form.cpf; payload.nome = form.nome; payload.telefone = form.telefone; payload.email = form.email; payload.matricula = form.matricula || null;
      }
      const res = await fetch(`${backendUrl}/api/${section}${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Falha");
      await refreshSection();
      goToListing();
    } catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
  };

  const handleDelete = async (id: string) => {
    await fetch(`${backendUrl}/api/${section}/${id}`, { method: "DELETE" });
    await refreshSection();
  };

  const label = (field: string, label: string, opts?: { type?: string; required?: boolean; min?: number }) => (
    <label>
      {label}
      <input
        type={opts?.type || "text"}
        {...(opts?.min ? { min: opts.min } : {})}
        value={form[field as keyof typeof form]}
        onChange={e => handleInput(field, e.target.value)}
        {...(opts?.required !== false ? { required: true } : {})}
      />
    </label>
  );

  return (
    <main>
      <div className="topbar">
        <h1>Acordes Music</h1>
        <div className="tabs">
          {(["salas", "professores", "alunos"] as Section[]).map(s => (
            <button key={s} className={s === section ? "active" : ""} onClick={() => { setSection(s); goToListing(); }}>
              {s === "salas" ? "Salas" : s === "professores" ? "Professores" : "Alunos"}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="center">Carregando...</p> : screen === "listing" ? (
        <div className="panel">
          <div className="panel-head">
            <h2>{section === "salas" ? "Salas" : section === "professores" ? "Professores" : "Alunos"}</h2>
            <button className="btn" onClick={() => { resetForm(); setScreen("create"); }}>+ Novo</button>
          </div>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
          <table>
            <thead>
              <tr>
                {section === "salas" ? <><th>Nome</th><th>Capacidade</th><th>Ações</th></> :
                 section === "professores" ? <><th>Nome</th><th>Email</th><th>Ações</th></> :
                 <><th>Nome</th><th>Email</th><th>Ações</th></>}
              </tr>
            </thead>
            <tbody>
              {(section === "salas" ? salas : section === "professores" ? professores : alunos).length === 0 ? (
                <tr><td colSpan={3}>Nenhum registro.</td></tr>
              ) : (
                (section === "salas" ? salas : section === "professores" ? professores : alunos).map(item => (
                  <tr key={item.id}>
                    {section === "salas" ? (
                      <><td>{(item as Sala).nome}</td><td>{(item as Sala).capacidade}</td></>
                    ) : section === "professores" ? (
                      <><td>{(item as Professor).usuario.nome}</td><td>{(item as Professor).usuario.email}</td></>
                    ) : (
                      <><td>{(item as Aluno).usuario.nome}</td><td>{(item as Aluno).usuario.email}</td></>
                    )}
                    <td className="actions">
                      <button className="mini" onClick={() => goToEdit(item)}>Editar</button>
                      <button className="mini danger" onClick={() => handleDelete(item.id)}>Excluir</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-head">
            <h2>{editingId ? "Editar" : "Cadastrar"} {section === "salas" ? "Sala" : section === "professores" ? "Professor" : "Aluno"}</h2>
            <button className="btn secondary" onClick={goToListing}>Voltar</button>
          </div>
          {error && <p className="error">{error}</p>}
          <form onSubmit={handleSubmit}>
            <div className="fields">
              {label("nome", "Nome")}
              {section === "salas" ? (
                <>{label("capacidade", "Capacidade", { type: "number", min: 1 })}</>
              ) : (
                <>{label("cpf", "CPF")}{label("email", "Email", { type: "email" })}{label("telefone", "Telefone")}</>
              )}
              {section === "professores" ? label("profissao", "Profissão", { required: false }) :
               section === "alunos" ? label("matricula", "Matrícula", { required: false }) : null}
            </div>
            <div className="form-actions">
              <button type="submit" className="btn">{editingId ? "Atualizar" : "Cadastrar"}</button>
              <button type="button" className="btn secondary" onClick={goToListing}>Cancelar</button>
              {editingId && <button type="button" className="btn danger" onClick={() => { handleDelete(editingId); goToListing(); }}>Excluir</button>}
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default App;
