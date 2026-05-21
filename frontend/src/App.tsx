import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle2, MoreHorizontal, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type Sala = { id: string; nome: string; capacidade: number; descricao?: string | null };
type Usuario = { id: string; cpf: string; nome: string; telefone: string; email: string };
type Professor = { id: string; usuario: Usuario; profissao?: string | null };
type Aluno = { id: string; usuario: Usuario; matricula?: string | null };
type Agendamento = {
  id: string;
  professorId: string;
  alunoId: string;
  salaId: string;
  data: string;
  horario: string;
  duracao: number;
  status: "AGENDADO" | "CONCLUIDO";
  observacao?: string | null;
  createdAt: string;
  professor: Professor;
  aluno: Aluno;
  sala: Sala;
};

type Section = "salas" | "professores" | "alunos" | "agendamentos";

const backendUrl = "http://localhost:3000";

const statusLabel: Record<string, string> = {
  AGENDADO: "Agendado",
  CONCLUIDO: "Concluído",
};

const statusBadge: Record<string, string> = {
  AGENDADO: "bg-amber-100 text-amber-700 border-amber-200",
  CONCLUIDO: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const tabs: { value: Section; label: string }[] = [
  { value: "salas", label: "Salas" },
  { value: "professores", label: "Professores" },
  { value: "alunos", label: "Alunos" },
  { value: "agendamentos", label: "Agendamentos" },
];

function App() {
  const [section, setSection] = useState<Section>("agendamentos");
  const [salas, setSalas] = useState<Sala[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [conflitos, setConflitos] = useState<string[]>([]);
  const [verificandoConflito, setVerificandoConflito] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ id: string; label: string } | null>(null);
  const conflitoReqId = useRef(0);
  const [form, setForm] = useState({
    nome: "", descricao: "", capacidade: "",
    cpf: "", email: "", telefone: "", profissao: "", matricula: "",
    professorId: "", alunoId: "", salaId: "",
    data: "", horario: "", duracao: "60", observacao: "",
  });

  useEffect(() => {
    if (error) setErrorDialogOpen(true);
  }, [error]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [a, b, c, d] = await Promise.all([
          fetch(`${backendUrl}/api/salas`),
          fetch(`${backendUrl}/api/professores`),
          fetch(`${backendUrl}/api/alunos`),
          fetch(`${backendUrl}/api/agendamentos`),
        ]);
        if (!a.ok || !b.ok || !c.ok || !d.ok) throw new Error("Falha ao carregar dados");
        const [sd, pd, ad, agd] = await Promise.all([a.json(), b.json(), c.json(), d.json()]);
        setSalas(sd); setProfessores(pd); setAlunos(ad); setAgendamentos(agd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setConflitos([]);
    setForm({
      nome: "", descricao: "", capacidade: "",
      cpf: "", email: "", telefone: "", profissao: "", matricula: "",
      professorId: "", alunoId: "", salaId: "",
      data: "", horario: "", duracao: "60", observacao: "",
    });
    setError(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (item: Sala | Professor | Aluno | Agendamento) => {
    resetForm();
    setEditingId(item.id);
    if ("capacidade" in item) {
      const s = item as Sala;
      setForm(p => ({ ...p, nome: s.nome, descricao: s.descricao ?? "", capacidade: String(s.capacidade) }));
      setSection("salas");
    } else if ("profissao" in item) {
      const prof = item as Professor;
      setForm(prev => ({ ...prev, nome: prof.usuario.nome, cpf: prof.usuario.cpf, email: prof.usuario.email, telefone: prof.usuario.telefone, profissao: prof.profissao ?? "" }));
      setSection("professores");
    } else if ("matricula" in item) {
      const a = item as Aluno;
      setForm(p => ({ ...p, nome: a.usuario.nome, cpf: a.usuario.cpf, email: a.usuario.email, telefone: a.usuario.telefone, matricula: a.matricula ?? "" }));
      setSection("alunos");
    } else {
      const a = item as Agendamento;
      setForm(p => ({
        ...p,
        professorId: a.professorId,
        alunoId: a.alunoId,
        salaId: a.salaId,
        data: a.data.slice(0, 10),
        horario: a.horario,
        duracao: String(a.duracao),
        observacao: a.observacao ?? "",
      }));
      setSection("agendamentos");
    }
    setDialogOpen(true);
  };

  const handleFormField = (field: string, value: string) => {
    setForm(p => ({ ...p, [field]: value }));
  };

  const conflitosRef = useRef(conflitos);
  useEffect(() => { conflitosRef.current = conflitos; });

  useEffect(() => {
    if (section !== "agendamentos" || !dialogOpen) {
      setConflitos([]);
      return;
    }
    const { professorId, alunoId, salaId, data, horario, duracao } = form;
    if (!professorId || !alunoId || !salaId || !data || !horario) return;

    const id = ++conflitoReqId.current;
    setVerificandoConflito(true);
    setConflitos([]);

    const params = new URLSearchParams({
      professorId, alunoId, salaId, data, horario,
      duracao: duracao || "60",
      ...(editingId ? { ignorarId: editingId } : {}),
    });

    (async () => {
      try {
        const res = await fetch(`${backendUrl}/api/agendamentos/verificar-conflito?${params}`);
        if (!res.ok) {
          if (id === conflitoReqId.current) setConflitos(["Erro ao verificar conflitos no servidor"]);
          return;
        }
        const json = await res.json();
        if (id === conflitoReqId.current) setConflitos(json.conflitos);
      } catch {
        if (id === conflitoReqId.current) setConflitos(["Erro de conexão ao verificar conflitos"]);
      } finally {
        if (id === conflitoReqId.current) setVerificandoConflito(false);
      }
    })();
  }, [section, dialogOpen, form.professorId, form.alunoId, form.salaId, form.data, form.horario, form.duracao, editingId]);

  const refreshData = async () => {
    const fetches: Promise<Response>[] = [];
    if (section === "salas" || section === "agendamentos") fetches.push(fetch(`${backendUrl}/api/salas`));
    if (section === "professores" || section === "agendamentos") fetches.push(fetch(`${backendUrl}/api/professores`));
    if (section === "alunos" || section === "agendamentos") fetches.push(fetch(`${backendUrl}/api/alunos`));
    fetches.push(fetch(`${backendUrl}/api/agendamentos`));

    const results = await Promise.all(fetches);
    const data = await Promise.all(results.map(r => r.json()));

    let idx = 0;
    if (section === "salas" || section === "agendamentos") { setSalas(data[idx]); idx++; }
    if (section === "professores" || section === "agendamentos") { setProfessores(data[idx]); idx++; }
    if (section === "alunos" || section === "agendamentos") { setAlunos(data[idx]); idx++; }
    setAgendamentos(data[idx]);
  };

  const handleSubmit = async () => {
    setError(null);

    if (section === "agendamentos") {
      if (!form.professorId || !form.alunoId || !form.salaId || !form.data || !form.horario) {
        setError("Preencha todos os campos obrigatórios");
        return;
      }
      if (conflitos.length > 0) {
        setError("Resolva os conflitos de horário antes de salvar");
        return;
      }
    }
    if (section === "salas" && !form.nome) { setError("Preencha o nome da sala"); return; }
    if ((section === "professores" || section === "alunos") && (!form.nome || !form.cpf || !form.email || !form.telefone)) {
      setError("Preencha todos os campos obrigatórios"); return;
    }

    try {
      let payload: Record<string, unknown> = {};
      let endpoint = section;
      if (section === "salas") {
        payload = { nome: form.nome, capacidade: Number(form.capacidade) || 1, descricao: form.descricao || null };
      } else if (section === "professores") {
        payload = { cpf: form.cpf, nome: form.nome, telefone: form.telefone, email: form.email, profissao: form.profissao || null };
      } else if (section === "alunos") {
        payload = { cpf: form.cpf, nome: form.nome, telefone: form.telefone, email: form.email, matricula: form.matricula || null };
      } else {
        endpoint = "agendamentos";
        payload = {
          professorId: form.professorId, alunoId: form.alunoId, salaId: form.salaId,
          data: form.data, horario: form.horario, duracao: Number(form.duracao) || 60,
          observacao: form.observacao || null,
        };
      }
      const res = await fetch(`${backendUrl}/api/${endpoint}${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Falha ao salvar");
      }
      await refreshData();
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  };

  const getItemLabel = (item: Sala | Professor | Aluno | Agendamento): string => {
    if ("nome" in item && "capacidade" in item) return (item as Sala).nome;
    if ("usuario" in item) return (item as Professor | Aluno).usuario.nome;
    if ("professor" in item) return `Agendamento de ${(item as Agendamento).professor.usuario.nome}`;
    return "";
  };

  const openDeleteDialog = (id: string, label: string) => {
    setDeletingItem({ id, label });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    try {
      const res = await fetch(`${backendUrl}/api/${section}/${deletingItem.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao excluir");
      }
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      await refreshData();
    } catch (err) {
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      setError(err instanceof Error ? err.message : "Erro ao excluir");
    }
  };

  const handleRegistrar = async (id: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/agendamentos/${id}/registrar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Falha ao registrar aula");
      }
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  };

  const agendamentosFiltrados = agendamentos.filter(a => !filterStatus || a.status === filterStatus);

  const renderTable = () => {
    if (section === "agendamentos") {
      const items = agendamentosFiltrados;
      if (items.length === 0) {
        return <p className="text-muted-foreground text-center py-12">Nenhum agendamento encontrado</p>;
      }
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Professor</TableHead>
              <TableHead>Aluno</TableHead>
              <TableHead>Sala</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.professor.usuario.nome}</TableCell>
                <TableCell>{a.aluno.usuario.nome}</TableCell>
                <TableCell>{a.sala.nome}</TableCell>
                <TableCell>{new Date(a.data).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{a.horario}h ({a.duracao}min)</TableCell>
                <TableCell>
                  <Badge className={statusBadge[a.status]}>{statusLabel[a.status]}</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="size-8 p-0">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(a)}>
                        <Pencil className="size-3.5" /> Editar
                      </DropdownMenuItem>
                      {a.status !== "CONCLUIDO" && (
                        <DropdownMenuItem onClick={() => handleRegistrar(a.id)}>
                          <CheckCircle2 className="size-3.5" /> Registrar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(a.id, `Agendamento de ${a.professor.usuario.nome}`)}
                        className="text-destructive"
                      >
                        <Trash2 className="size-3.5" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    const items = section === "salas" ? salas : section === "professores" ? professores : alunos;
    if (items.length === 0) {
      return <p className="text-muted-foreground text-center py-12">Nenhum registro encontrado</p>;
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            {section === "salas" ? (
              <><TableHead>Nome</TableHead><TableHead>Capacidade</TableHead><TableHead className="w-32">Ações</TableHead></>
            ) : (
              <><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead className="w-32">Ações</TableHead></>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.id}>
              {section === "salas" ? (
                <><TableCell className="font-medium">{(item as Sala).nome}</TableCell><TableCell>{(item as Sala).capacidade}</TableCell></>
              ) : section === "professores" ? (
                <><TableCell className="font-medium">{(item as Professor).usuario.nome}</TableCell><TableCell>{(item as Professor).usuario.email}</TableCell></>
              ) : (
                <><TableCell className="font-medium">{(item as Aluno).usuario.nome}</TableCell><TableCell>{(item as Aluno).usuario.email}</TableCell></>
              )}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="size-8 p-0">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(item)}>
                      <Pencil className="size-3.5" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openDeleteDialog(item.id, getItemLabel(item))}
                      className="text-destructive"
                    >
                      <Trash2 className="size-3.5" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderFormFields = () => {
    if (section === "agendamentos") {
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Professor</Label>
            <Select value={form.professorId} onValueChange={v => handleFormField("professorId", v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {professores.map(p => <SelectItem key={p.id} value={p.id}>{p.usuario.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Aluno</Label>
            <Select value={form.alunoId} onValueChange={v => handleFormField("alunoId", v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {alunos.map(a => <SelectItem key={a.id} value={a.id}>{a.usuario.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sala</Label>
            <Select value={form.salaId} onValueChange={v => handleFormField("salaId", v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {salas.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={form.data} onChange={e => handleFormField("data", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Horário</Label>
            <Input type="time" value={form.horario} onChange={e => handleFormField("horario", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Duração (min)</Label>
            <Input type="number" min={1} value={form.duracao} onChange={e => handleFormField("duracao", e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Observação</Label>
            <Input value={form.observacao} onChange={e => handleFormField("observacao", e.target.value)} placeholder="Observações sobre a aula..." />
          </div>
          {conflitos.length > 0 && (
            <div className="col-span-2 bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              <p className="font-semibold mb-1">Conflito de horário:</p>
              <ul className="list-disc pl-4 space-y-0.5">{conflitos.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}
          {verificandoConflito && (
            <div className="col-span-2 text-muted-foreground text-sm flex items-center gap-2">
              <span className="size-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin inline-block" />
              Verificando conflitos...
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={form.nome} onChange={e => handleFormField("nome", e.target.value)} required />
        </div>
        {section === "salas" ? (
          <div className="space-y-2">
            <Label>Capacidade</Label>
            <Input type="number" min={1} value={form.capacidade} onChange={e => handleFormField("capacidade", e.target.value)} required />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={e => handleFormField("cpf", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => handleFormField("email", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={e => handleFormField("telefone", e.target.value)} required />
            </div>
          </>
        )}
        {section === "salas" && (
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={e => handleFormField("descricao", e.target.value)} />
          </div>
        )}
        {section === "professores" && (
          <div className="space-y-2">
            <Label>Profissão</Label>
            <Input value={form.profissao} onChange={e => handleFormField("profissao", e.target.value)} />
          </div>
        )}
        {section === "alunos" && (
          <div className="space-y-2">
            <Label>Matrícula</Label>
            <Input value={form.matricula} onChange={e => handleFormField("matricula", e.target.value)} />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="size-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin inline-block" />
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Acordes Music</h1>
          <nav className="flex gap-1">
            {tabs.map(t => (
              <Button
                key={t.value}
                variant={section === t.value ? "default" : "ghost"}
                size="sm"
                onClick={() => { setSection(t.value); setDialogOpen(false); }}
              >
                {t.label}
              </Button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>
                {section === "salas" ? "Salas" :
                 section === "professores" ? "Professores" :
                 section === "alunos" ? "Alunos" : "Agendamentos"}
              </CardTitle>
              <Button onClick={openCreate}><Plus className="size-4" /> Novo</Button>
            </CardHeader>
            <CardContent>
              {section === "agendamentos" && (
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={!filterStatus ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus("")}
                  >Todos</Button>
                  {["AGENDADO", "CONCLUIDO"].map(s => (
                    <Button
                      key={s}
                      variant={filterStatus === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterStatus(s)}
                    >{statusLabel[s]}</Button>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">{renderTable()}</div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir {deletingItem?.label}? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={errorDialogOpen} onOpenChange={v => { setErrorDialogOpen(v); if (!v) setError(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Erro</DialogTitle>
            <DialogDescription>{error}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="default" onClick={() => { setErrorDialogOpen(false); setError(null); }}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar" : "Novo"}{" "}
              {section === "salas" ? "Sala" :
               section === "professores" ? "Professor" :
               section === "alunos" ? "Aluno" : "Agendamento"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para {editingId ? "atualizar" : "cadastrar"}.
            </DialogDescription>
          </DialogHeader>

          {renderFormFields()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={section === "agendamentos" && conflitos.length > 0}>
              {editingId ? "Atualizar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
