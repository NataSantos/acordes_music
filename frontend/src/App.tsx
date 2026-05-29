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
import { Plus, Trash2, CheckCircle2, MoreHorizontal, Pencil, AlertTriangle, Building2, GraduationCap, BookUser, CalendarDays, Music, PanelLeftClose, PanelLeftOpen, ListFilter, CalendarClock, Search, User, LogOut } from "lucide-react";
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

const tabs: { value: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "salas", label: "Salas", icon: Building2 },
  { value: "professores", label: "Professores", icon: GraduationCap },
  { value: "alunos", label: "Alunos", icon: BookUser },
  { value: "agendamentos", label: "Agendamentos", icon: CalendarDays },
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
  const [filterSala, setFilterSala] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ id: string; label: string } | null>(null);
  const conflitoReqId = useRef(0);
  const [form, setForm] = useState({
    nome: "", descricao: "", capacidade: "",
    cpf: "", email: "", telefone: "", profissao: "", matricula: "",
    professorId: "", alunoId: "", salaId: "",
    data: "", horario: "", duracao: "60", observacao: "",
  });
  const [repetirSemanal, setRepetirSemanal] = useState(false);
  const [repetirSemanas, setRepetirSemanas] = useState(4);
  const [user, setUser] = useState<{ nome: string; role: string; professorId: string | null; token: string; cpf: string } | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [senhaDialogOpen, setSenhaDialogOpen] = useState(false);
  const [senhaForm, setSenhaForm] = useState({ senhaAtual: "", senhaNova: "", confirmar: "" });
  const [perfilDialogOpen, setPerfilDialogOpen] = useState(false);
  const [perfilForm, setPerfilForm] = useState({ nome: "", email: "", telefone: "" });
  const [perfilLoading, setPerfilLoading] = useState(false);

  useEffect(() => {
    if (error) setErrorDialogOpen(true);
  }, [error]);

  const apiFetch = async (url: string, options?: RequestInit) => {
    const headers: Record<string, string> = { ...(options?.headers as Record<string, string> || {}) };
    if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;
    if (!headers["Content-Type"] && options?.method !== "GET" && !(options?.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    return fetch(url, { ...options, headers });
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginSenha) { setLoginError("Preencha email e senha"); return; }
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, senha: loginSenha }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Email ou senha inválidos");
      }
      const data = await res.json();
      setUser({ nome: data.usuario.nome, role: data.usuario.role, professorId: data.usuario.professorId, token: data.token, cpf: data.usuario.cpf });
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setLoginEmail("");
    setLoginSenha("");
  };

  const handleAlterarSenha = async () => {
    if (!senhaForm.senhaAtual || !senhaForm.senhaNova) { setError("Preencha todos os campos"); return; }
    if (senhaForm.senhaNova.length < 4) { setError("A nova senha deve ter no mínimo 4 caracteres"); return; }
    if (senhaForm.senhaNova !== senhaForm.confirmar) { setError("As senhas não conferem"); return; }
    try {
      const res = await apiFetch(`${backendUrl}/api/auth/senha`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual: senhaForm.senhaAtual, senhaNova: senhaForm.senhaNova }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Erro ao alterar senha");
      }
      setSenhaDialogOpen(false);
      setSenhaForm({ senhaAtual: "", senhaNova: "", confirmar: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar senha");
    }
  };

  const handleEditarPerfil = async () => {
    if (!perfilForm.nome || !perfilForm.email || !perfilForm.telefone) {
      setError("Preencha todos os campos"); return;
    }
    setPerfilLoading(true);
    try {
      const res = await apiFetch(`${backendUrl}/api/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(perfilForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Erro ao atualizar perfil");
      }
      const data = await res.json();
      setUser(p => p ? { ...p, nome: data.nome } : null);
      setPerfilDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar perfil");
    } finally {
      setPerfilLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;
        const [a, b, c] = await Promise.all([
          fetch(`${backendUrl}/api/salas`),
          fetch(`${backendUrl}/api/professores`),
          fetch(`${backendUrl}/api/alunos`),
        ]);
        if (!a.ok || !b.ok || !c.ok) throw new Error("Falha ao carregar dados");
        const [sd, pd, ad] = await Promise.all([a.json(), b.json(), c.json()]);
        setSalas(sd); setProfessores(pd); setAlunos(ad);

        const agdRes = await fetch(`${backendUrl}/api/agendamentos${user?.role === "PROFESSOR" && user.professorId ? `?professorId=${user.professorId}` : ""}`, { headers });
        if (!agdRes.ok) throw new Error("Falha ao carregar agendamentos");
        setAgendamentos(await agdRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const resetForm = () => {
    setEditingId(null);
    setConflitos([]);
    setRepetirSemanal(false);
    setRepetirSemanas(4);
    setForm({
      nome: "", descricao: "", capacidade: "",
      cpf: "", email: "", telefone: "", profissao: "", matricula: "",
      professorId: "", alunoId: "", salaId: "",
      data: "", horario: "", duracao: "60", observacao: "",
    });
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    if (user?.role === "PROFESSOR" && user.professorId) {
      setForm(p => ({ ...p, professorId: user.professorId! }));
    }
    setDialogOpen(true);
  };

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

  const capitalize = (str: string) => {
    return str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
  };

  const handleFormField = (field: string, value: string) => {
    if (field === "nome" || field === "profissao") {
      value = capitalize(value);
    }
    if (field === "cpf" || field === "telefone") {
      value = value.replace(/\D/g, "");
    }
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
    const headers: Record<string, string> = {};
    if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;
    const fetches: Promise<Response>[] = [];
    if (section === "salas" || section === "agendamentos") fetches.push(fetch(`${backendUrl}/api/salas`));
    if (section === "professores" || section === "agendamentos") fetches.push(fetch(`${backendUrl}/api/professores`));
    if (section === "alunos" || section === "agendamentos") fetches.push(fetch(`${backendUrl}/api/alunos`));
    const agdUrl = `${backendUrl}/api/agendamentos${user?.role === "PROFESSOR" && user.professorId ? `?professorId=${user.professorId}` : ""}`;
    fetches.push(fetch(agdUrl, { headers }));

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
    if (section === "salas") {
      if (!form.nome) { setError("Preencha o nome da sala"); return; }
      const nomeDuplicado = salas.find(s => s.nome.toLowerCase() === form.nome.toLowerCase() && s.id !== editingId);
      if (nomeDuplicado) { setError(`Já existe uma sala cadastrada com o nome "${form.nome}"`); return; }
    }
    if (section === "professores" || section === "alunos") {
      if (!form.nome || !form.cpf || !form.email || !form.telefone) {
        setError("Preencha todos os campos obrigatórios"); return;
      }
      const todosUsuarios = [...professores.map(p => p.usuario), ...alunos.map(a => a.usuario)];
      const usuarioAtualId = section === "professores"
        ? professores.find(p => p.id === editingId)?.usuario?.id
        : alunos.find(a => a.id === editingId)?.usuario?.id;
      const duplicado = todosUsuarios.find(u =>
        (u.cpf === form.cpf || u.email === form.email) && u.id !== usuarioAtualId
      );
      if (duplicado) {
        const motivo = duplicado.cpf === form.cpf ? "CPF" : "email";
        const tipo = section === "professores" ? "professor" : "aluno";
        setError(`Já existe um ${tipo} cadastrado com este ${motivo}`); return;
      }
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

      if (section === "agendamentos" && repetirSemanal && !editingId) {
        const datas: string[] = [form.data];
        for (let i = 1; i < repetirSemanas; i++) {
          const d = new Date(form.data.slice(0, 10) + "T12:00:00");
          d.setDate(d.getDate() + i * 7);
          datas.push(d.toISOString().slice(0, 10));
        }
        for (const data of datas) {
          const res = await fetch(`${backendUrl}/api/agendamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, data }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => null);
            throw new Error(errData?.error || `Falha ao criar agendamento do dia ${data}`);
          }
        }
      } else {
        const res = await fetch(`${backendUrl}/api/${endpoint}${editingId ? `/${editingId}` : ""}`, {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Falha ao salvar");
        }
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

  const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const agendamentosFiltrados = agendamentos.filter(a =>
    (!filterStatus || a.status === filterStatus) &&
    (!filterSala || a.salaId === filterSala) &&
    (!q || (a.sala.nome + " " + a.professor.usuario.nome + " " + a.aluno.usuario.nome + " " + a.observacao + " " + a.horario)
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q))
  );

  const salasFiltradas = salas.filter(s =>
    !q || s.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)
  );

  const professoresFiltrados = professores.filter(p =>
    !q || (p.usuario.nome + " " + p.usuario.email + " " + p.usuario.cpf + " " + (p.profissao ?? ""))
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)
  );

  const alunosFiltrados = alunos.filter(a =>
    !q || (a.usuario.nome + " " + a.usuario.email + " " + a.usuario.cpf + " " + (a.matricula ?? ""))
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)
  );

  const renderTable = () => {
    if (section === "agendamentos") {
      const items = agendamentosFiltrados;
      if (items.length === 0) {
        return <p className="text-muted-foreground text-center py-12">Nenhum agendamento encontrado</p>;
      }

      const sorted = [...items].sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario));

      const monthNames: Record<string, string> = {
        "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
        "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
        "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
      };

      const monthGroups = sorted.reduce<Record<string, typeof sorted>>((acc, a) => {
        const key = a.data.slice(0, 7);
        if (!acc[key]) acc[key] = [];
        acc[key].push(a);
        return acc;
      }, {});

      const getWeekStart = (dateStr: string) => {
        const d = new Date(dateStr.slice(0, 10) + "T12:00:00");
        const day = d.getDay();
        d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
        return d.toISOString().slice(0, 10);
      };

      const fmt = (dateStr: string) => {
        const d = new Date(dateStr.slice(0, 10) + "T12:00:00");
        return d.toLocaleDateString("pt-BR");
      };

      const fmtWeekRange = (ws: string) => {
        const start = new Date(ws + "T12:00:00");
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return `${fmt(start.toISOString().slice(0, 10))} — ${fmt(end.toISOString().slice(0, 10))}`;
      };

      const fmtDay = (dateStr: string) => {
        const d = new Date(dateStr.slice(0, 10) + "T12:00:00");
        const nomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${nomes[d.getDay()]}`;
      };

      return (
        <div className="space-y-8">
          {Object.entries(monthGroups).sort(([a], [b]) => a.localeCompare(b)).map(([monthKey, monthItems]) => {
            const [year, monthNum] = monthKey.split("-");
            const monthLabel = `${monthNames[monthNum] || monthNum} ${year}`;

            const weekGroups = monthItems.reduce<Record<string, typeof monthItems>>((acc, a) => {
              const wk = getWeekStart(a.data);
              if (!acc[wk]) acc[wk] = [];
              acc[wk].push(a);
              return acc;
            }, {});

            const sortedWeeks = Object.keys(weekGroups).sort();

            return (
              <div key={monthKey}>
                <div className="flex items-baseline gap-3 mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">{monthLabel}</h2>
                  <span className="text-sm text-muted-foreground">
                    {monthItems.length} aula{monthItems.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-4">
                  {sortedWeeks.map(weekId => {
                    const weekItems = weekGroups[weekId];

                    const dayGroups = weekItems.reduce<Record<string, typeof weekItems>>((acc, a) => {
                      const dayKey = a.data.slice(0, 10);
                      if (!acc[dayKey]) acc[dayKey] = [];
                      acc[dayKey].push(a);
                      return acc;
                    }, {});

                    const sortedDays = Object.keys(dayGroups).sort();

                    return (
                      <Card key={weekId}>
                        <CardHeader className="py-3 px-5 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">
                              Semana de {fmtWeekRange(weekId)}
                            </CardTitle>
                            <span className="text-xs text-muted-foreground">
                              {weekItems.length} aula{weekItems.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0 divide-y">
                          {sortedDays.map(dayKey => {
                            const dayItems = dayGroups[dayKey];
                            const hoje = new Date().toISOString().slice(0, 10) === dayKey;

                            return (
                              <div key={dayKey}>
                                <div className={`px-5 py-2 text-xs font-medium uppercase tracking-wider flex items-center gap-2 ${hoje ? "bg-primary/10 text-primary" : "bg-muted/20 text-muted-foreground"}`}>
                                  <span>{fmtDay(dayKey)}</span>
                                  {hoje && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold">HOJE</span>}
                                </div>
                                <div className="divide-y">
                                  {dayItems.map(a => {
                                    const duracaoLabel = a.duracao !== 60 ? `${a.duracao}min` : "";

                                    return (
                                      <div
                                        key={a.id}
                                        className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto] gap-3 px-5 py-3 items-center text-sm hover:bg-muted/30 transition-colors"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-[64px]">
                                          <span className="font-mono text-sm font-semibold">{a.horario}</span>
                                          {duracaoLabel && <span className="text-muted-foreground text-xs">({duracaoLabel})</span>}
                                        </div>
                                        <div className="truncate min-w-0">
                                          <span className="text-muted-foreground text-[11px] block leading-tight">Sala</span>
                                          <span className="font-medium truncate block">{a.sala.nome}</span>
                                        </div>
                                        <div className="truncate min-w-0">
                                          <span className="text-muted-foreground text-[11px] block leading-tight">Professor</span>
                                          <span className="font-medium truncate block">{a.professor.usuario.nome}</span>
                                        </div>
                                        <div className="truncate min-w-0">
                                          <span className="text-muted-foreground text-[11px] block leading-tight">Aluno</span>
                                          <span className="font-medium truncate block">{a.aluno.usuario.nome}</span>
                                        </div>
                                        <Badge className={statusBadge[a.status] + " shrink-0 self-center"}>{statusLabel[a.status]}</Badge>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="size-8 p-0 shrink-0 self-center">
                                              <MoreHorizontal className="size-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            {a.status !== "CONCLUIDO" && (
                                              <DropdownMenuItem onClick={() => openEdit(a)}>
                                                <CalendarClock className="size-3.5" /> Reagendar
                                              </DropdownMenuItem>
                                            )}
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
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    const items = section === "salas" ? salasFiltradas : section === "professores" ? professoresFiltrados : alunosFiltrados;
    if (items.length === 0) {
      return <p className="text-muted-foreground text-center py-12">Nenhum registro encontrado</p>;
    }

    const podeEditar = user?.role === "ADMIN";

    return (
      <Table>
        <TableHeader>
          <TableRow>
            {section === "salas" ? (
              <><TableHead>Nome</TableHead><TableHead>Capacidade</TableHead>{podeEditar && <TableHead className="w-32">Ações</TableHead>}</>
            ) : (
              <><TableHead>Nome</TableHead><TableHead>Email</TableHead>{podeEditar && <TableHead className="w-32">Ações</TableHead>}</>
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
              {podeEditar && (
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
              )}
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
            {user?.role === "PROFESSOR" ? (
              <Input value={professores.find(p => p.id === user.professorId)?.usuario?.nome || ""} disabled className="bg-muted" />
            ) : (
              <Select value={form.professorId} onValueChange={v => handleFormField("professorId", v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {professores.map(p => <SelectItem key={p.id} value={p.id}>{p.usuario.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
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
          {!editingId && (
            <div className="col-span-2 flex items-center gap-3 pt-1">
              <Label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="size-4 accent-neutral-900"
                  checked={repetirSemanal}
                  onChange={e => setRepetirSemanal(e.target.checked)}
                />
                <span>Repetir semanalmente</span>
              </Label>
              {repetirSemanal && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span>por</span>
                  <Input
                    type="number"
                    min={2}
                    max={52}
                    className="w-16 h-8 text-center text-sm"
                    value={String(repetirSemanas)}
                    onChange={e => setRepetirSemanas(Number(e.target.value) || 4)}
                  />
                  <span className="text-muted-foreground">semanas</span>
                </div>
              )}
            </div>
          )}
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

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950">
        <div className="w-full max-w-sm mx-auto p-8">
          <div className="flex flex-col items-center gap-2 mb-8">
            <Music className="size-10 text-white" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Acordes Music</h1>
            <p className="text-sm text-white/50">Faça login para continuar</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/70 text-xs uppercase tracking-wider">Email</Label>
              <Input
                type="email"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10"
                placeholder="Digite seu email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70 text-xs uppercase tracking-wider">Senha</Label>
              <Input
                type="password"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10"
                placeholder="Digite sua senha"
                value={loginSenha}
                onChange={e => setLoginSenha(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>
            {loginError && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 rounded-md px-3 py-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <Button className="w-full h-10" onClick={handleLogin} disabled={loginLoading}>
              {loginLoading ? "Entrando..." : "Entrar"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="h-screen flex">
      <aside className={`${sidebarCollapsed ? "w-14" : "w-60"} transition-all duration-300 bg-neutral-950 text-white flex flex-col shrink-0`}>
        <div className="h-14 border-b border-white/10 flex items-center gap-2 px-4">
          <Music className="size-5 shrink-0" />
          {!sidebarCollapsed && <span className="font-bold tracking-tight truncate">Acordes Music</span>}
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <Button
                key={t.value}
                variant="ghost"
                className={`w-full justify-start gap-3 h-9 px-2 text-sm font-normal text-white/80 hover:text-white hover:bg-white/10 ${section === t.value ? "bg-white/10 text-white" : ""}`}
                onClick={() => { setSection(t.value); setDialogOpen(false); }}
              >
                <Icon className="size-4 shrink-0" />
                {!sidebarCollapsed && t.label}
              </Button>
            );
          })}
        </nav>
        {section === "agendamentos" && !sidebarCollapsed && (
          <div className="px-3 py-3 space-y-3 border-t border-white/10">
            <div className="space-y-2">
              <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Status</span>
              <div className="flex flex-wrap gap-1">
                <button
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${!filterStatus ? "bg-white/20 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}
                  onClick={() => setFilterStatus("")}
                >Todos</button>
                {["AGENDADO", "CONCLUIDO"].map(s => (
                  <button
                    key={s}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${filterStatus === s ? "bg-white/20 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}
                    onClick={() => setFilterStatus(s)}
                  >{statusLabel[s]}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Sala</span>
              <Select value={filterSala || "todas"} onValueChange={v => setFilterSala(v === "todas" ? "" : v)}>
                <SelectTrigger className="w-full h-8 text-xs bg-white/5 border-white/10 text-white/80">
                  <SelectValue placeholder="Todas as salas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as salas</SelectItem>
                  {salas.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {section === "agendamentos" && sidebarCollapsed && (
          <div className="px-1 py-2 border-t border-white/10 flex justify-center">
            <button
              className="relative size-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setSidebarCollapsed(false)}
              title="Filtros"
            >
              <ListFilter className="size-4" />
              {(filterStatus || filterSala) && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-blue-400" />
              )}
            </button>
          </div>
        )}
        <div className="mt-auto border-t border-white/10">
          {!sidebarCollapsed && (
            <div className="px-3 py-2 border-b border-white/10">
              <button
                className="flex items-center gap-2 w-full text-xs text-white/60 hover:text-white transition-colors"
                onClick={async () => {
                  try {
                    const res = await apiFetch(`${backendUrl}/api/auth/me`);
                    if (res.ok) {
                      const data = await res.json();
                      setPerfilForm({ nome: data.nome, email: data.email, telefone: data.telefone ?? "" });
                    } else {
                      setPerfilForm({ nome: user?.nome ?? "", email: "", telefone: "" });
                    }
                  } catch {
                    setPerfilForm({ nome: user?.nome ?? "", email: "", telefone: "" });
                  }
                  setPerfilDialogOpen(true);
                }}
              >
                <User className="size-3.5" />
                <span>Editar Perfil</span>
              </button>
            </div>
          )}
          <div className="p-2 flex gap-1 items-center">
            {!sidebarCollapsed && (
              <span className="flex-1 truncate text-xs text-white/50 px-1">{user?.nome}</span>
            )}
            {!sidebarCollapsed && user?.role === "PROFESSOR" && (
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0 text-white/60 hover:text-white hover:bg-white/10 shrink-0"
                onClick={() => { setSenhaForm({ senhaAtual: "", senhaNova: "", confirmar: "" }); setSenhaDialogOpen(true); }}
                title="Alterar senha"
              >
                <span className="text-[10px] font-medium">#</span>
              </Button>
            )}
            {sidebarCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0 text-white/60 hover:text-white hover:bg-white/10 shrink-0"
                onClick={async () => {
                  try {
                    const res = await apiFetch(`${backendUrl}/api/auth/me`);
                    if (res.ok) {
                      const data = await res.json();
                      setPerfilForm({ nome: data.nome, email: data.email, telefone: data.telefone ?? "" });
                    } else {
                      setPerfilForm({ nome: user?.nome ?? "", email: "", telefone: "" });
                    }
                  } catch {
                    setPerfilForm({ nome: user?.nome ?? "", email: "", telefone: "" });
                  }
                  setPerfilDialogOpen(true);
                }}
                title="Editar Perfil"
              >
                <User className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0 text-white/60 hover:text-white hover:bg-white/10 shrink-0"
              onClick={handleLogout}
              title="Sair"
            >
              <LogOut className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0 text-white/60 hover:text-white hover:bg-white/10 shrink-0"
              onClick={() => setSidebarCollapsed(p => !p)}
              title={sidebarCollapsed ? "Expandir" : "Recolher"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-4">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {section === "salas" ? "Salas" :
                     section === "professores" ? "Professores" :
                     section === "alunos" ? "Alunos" : "Agendamentos"}
                  </CardTitle>
                  <Button size="sm" onClick={openCreate} style={{ display: (user?.role !== "ADMIN" && section !== "agendamentos") ? "none" : undefined }}>
                    <Plus className="size-3.5" /> Novo
                  </Button>
                </div>
                <div className="relative max-w-xs">
                  <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="w-full h-9 pl-8 text-sm"
                    placeholder="Pesquisar..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">{renderTable()}</div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

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
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="flex flex-row items-start gap-3">
            <div className="rounded-full bg-destructive/10 p-2 shrink-0 mt-0.5">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-destructive">Erro</DialogTitle>
              <DialogDescription className="text-sm mt-1 text-foreground/80">{error}</DialogDescription>
            </div>
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

      <Dialog open={senhaDialogOpen} onOpenChange={setSenhaDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>Digite sua senha atual e a nova senha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Senha atual</Label>
              <Input type="password" value={senhaForm.senhaAtual} onChange={e => setSenhaForm(p => ({ ...p, senhaAtual: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input type="password" value={senhaForm.senhaNova} onChange={e => setSenhaForm(p => ({ ...p, senhaNova: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input type="password" value={senhaForm.confirmar} onChange={e => setSenhaForm(p => ({ ...p, confirmar: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSenhaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAlterarSenha}>Alterar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={perfilDialogOpen} onOpenChange={v => { setPerfilDialogOpen(v); if (!v) setError(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
            <DialogDescription>Atualize suas informações pessoais.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={perfilForm.nome} onChange={e => setPerfilForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={perfilForm.email} onChange={e => setPerfilForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={perfilForm.telefone} onChange={e => setPerfilForm(p => ({ ...p, telefone: e.target.value.replace(/\D/g, "") }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPerfilDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditarPerfil} disabled={perfilLoading}>{perfilLoading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
