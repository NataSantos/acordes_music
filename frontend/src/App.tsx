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
import { Plus, Trash2, CheckCircle2, MoreHorizontal, Pencil, AlertTriangle, Building2, GraduationCap, BookUser, CalendarDays, Music, PanelLeftClose, PanelLeftOpen, ListFilter, CalendarClock, Search, User, LogOut, Wallet, DollarSign, Clock, TrendingUp, Eye, EyeOff } from "lucide-react";
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
  valor?: number | null;
  observacao?: string | null;
  createdAt: string;
  professor: Professor;
  aluno: Aluno;
  sala: Sala;
};

type GanhosResumo = {
  totalBruto: number;
  totalAulas: number;
  totalHoras: number;
  mediaPorAula: number;
  periodo: { de: string | null; ate: string | null };
};

type GanhosProfessor = { id: string; nome: string; aulas: number; valor: number; horas: number };
type GanhosMes = { mes: string; aulas: number; valor: number };

type GanhosData = {
  resumo: GanhosResumo;
  porProfessor: GanhosProfessor[];
  porMes: GanhosMes[];
  aulas: Agendamento[];
};

type Section = "salas" | "professores" | "alunos" | "agendamentos" | "financeiro";

const backendUrl = import.meta.env.VITE_API_URL ?? `http://${location.hostname}:3000`;

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
  { value: "financeiro", label: "Financeiro", icon: Wallet },
];

function App() {
  const [section, setSection] = useState<Section>(() => {
    const hash = location.hash.replace("#", "") as Section;
    return ["salas", "professores", "alunos", "agendamentos", "financeiro"].includes(hash) ? hash : "agendamentos";
  });
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
    data: "", horario: "", duracao: "60", valor: "", observacao: "",
  });
  const [repetirSemanal, setRepetirSemanal] = useState(false);
  const [repetirSemanas, setRepetirSemanas] = useState(4);
  const [user, setUser] = useState<{ nome: string; role: string; professorId: string | null; token: string; cpf: string } | null>(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [recuperarSenhaDialogOpen, setRecuperarSenhaDialogOpen] = useState(false);
  const [recuperarSenhaEmail, setRecuperarSenhaEmail] = useState("");
  const [recuperarSenhaLoading, setRecuperarSenhaLoading] = useState(false);
  const [recuperarSenhaMessage, setRecuperarSenhaMessage] = useState<string | null>(null);
  const [senhaDialogOpen, setSenhaDialogOpen] = useState(false);
  const [senhaForm, setSenhaForm] = useState({ senhaAtual: "", senhaNova: "", confirmar: "" });
  const [perfilDialogOpen, setPerfilDialogOpen] = useState(false);
  const [perfilForm, setPerfilForm] = useState({ nome: "", email: "", telefone: "" });
  const [perfilLoading, setPerfilLoading] = useState(false);
  const [ganhos, setGanhos] = useState<GanhosData | null>(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [filtroDataFim, setFiltroDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [ganhosLoading, setGanhosLoading] = useState(false);

  useEffect(() => {
    if (section !== "financeiro" || !user) return;
    (async () => {
      setGanhosLoading(true);
      try {
        const params = new URLSearchParams({ dataInicio: filtroDataInicio, dataFim: filtroDataFim });
        const res = await apiFetch(`${backendUrl}/api/ganhos?${params}`);
        if (res.ok) setGanhos(await res.json());
      } catch (err) {
        console.error("Erro ao carregar financeiro:", err);
      } finally {
        setGanhosLoading(false);
      }
    })();
  }, [section, filtroDataInicio, filtroDataFim, user]);

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

  useEffect(() => {
    location.hash = section;
  }, [section]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = location.hash.replace("#", "") as Section;
      if (["salas", "professores", "alunos", "agendamentos", "financeiro"].includes(hash)) {
        setSection(hash);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleLogin = async () => {
    if (!loginEmail || !loginSenha) { setLoginError("Preencha email e senha"); return; }
    setLoginLoading(true);
    setLoginError("");
    setError(null);
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
      localStorage.setItem("user", JSON.stringify({
        nome: data.usuario.nome, role: data.usuario.role,
        professorId: data.usuario.professorId, token: data.token, cpf: data.usuario.cpf
      }));
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRecuperarSenha = async () => {
    if (!recuperarSenhaEmail) { setRecuperarSenhaMessage("Digite seu email"); return; }
    setRecuperarSenhaLoading(true);
    setRecuperarSenhaMessage(null);
    try {
      const res = await fetch(`${backendUrl}/api/auth/recuperar-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recuperarSenhaEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecuperarSenhaMessage(data.message);
      } else {
        setRecuperarSenhaMessage(data.error || "Erro ao recuperar senha");
      }
    } catch {
      setRecuperarSenhaMessage("Erro de conexão com o servidor");
    } finally {
      setRecuperarSenhaLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
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
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        u.nome = data.nome;
        localStorage.setItem("user", JSON.stringify(u));
      }
      setPerfilDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar perfil");
    } finally {
      setPerfilLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;
        const [a, b, c] = await Promise.all([
          fetch(`${backendUrl}/api/salas`, { headers }),
          fetch(`${backendUrl}/api/professores`, { headers }),
          fetch(`${backendUrl}/api/alunos`, { headers }),
        ]);
        if (!a.ok || !b.ok || !c.ok) {
          if (a.status === 401 || b.status === 401 || c.status === 401) {
            setUser(null);
            localStorage.removeItem("user");
            return;
          }
          throw new Error("Falha ao carregar dados");
        }
        const [sd, pd, ad] = await Promise.all([a.json(), b.json(), c.json()]);
        setSalas(sd); setProfessores(pd); setAlunos(ad);

        const agdUrl = `${backendUrl}/api/agendamentos${user?.role === "PROFESSOR" && user.professorId ? `?professorId=${user.professorId}` : ""}`;
        const agdRes = await fetch(agdUrl, { headers });
        if (!agdRes.ok) {
          if (agdRes.status === 401) {
            setUser(null);
            localStorage.removeItem("user");
            return;
          }
          throw new Error("Falha ao carregar agendamentos");
        }
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
    data: "", horario: "", duracao: "60", valor: "", observacao: "",
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
        valor: a.valor ? String(a.valor) : "",
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
        const res = await apiFetch(`${backendUrl}/api/agendamentos/verificar-conflito?${params}`);
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
    if (section === "salas" || section === "agendamentos") fetches.push(fetch(`${backendUrl}/api/salas`, { headers }));
    if (section === "professores" || section === "agendamentos") fetches.push(fetch(`${backendUrl}/api/professores`, { headers }));
    if (section === "alunos" || section === "agendamentos") fetches.push(fetch(`${backendUrl}/api/alunos`, { headers }));
    const agdUrl = `${backendUrl}/api/agendamentos${user?.role === "PROFESSOR" && user.professorId ? `?professorId=${user.professorId}` : ""}`;
    fetches.push(fetch(agdUrl, { headers }));

    const results = await Promise.all(fetches);
    if (results.some(r => r.status === 401)) {
      setUser(null);
      localStorage.removeItem("user");
      return;
    }
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
          valor: form.valor ? Number(form.valor) : null,
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
          const res = await apiFetch(`${backendUrl}/api/agendamentos`, {
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
        const res = await apiFetch(`${backendUrl}/api/${endpoint}${editingId ? `/${editingId}` : ""}`, {
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
      const res = await apiFetch(`${backendUrl}/api/${section}/${deletingItem.id}`, { method: "DELETE" });
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
      const res = await apiFetch(`${backendUrl}/api/agendamentos/${id}/registrar`, {
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
        return (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
            <CalendarDays className="size-12 mb-4" />
            <p className="text-sm font-medium text-muted-foreground/70">Nenhum agendamento encontrado</p>
            <p className="text-xs text-muted-foreground/40 mt-1">Tente ajustar os filtros ou crie um novo agendamento</p>
          </div>
        );
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
        <div className="space-y-6 p-5">
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
                <div className="flex items-baseline gap-3 mb-5">
                  <h2 className="text-xl font-bold tracking-tight">{monthLabel}</h2>
                  <span className="text-sm text-muted-foreground">
                    {monthItems.length} aula{monthItems.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-3">
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
                      <Card key={weekId} className="border-border/60 shadow-sm overflow-hidden">
                        <div className="h-0.5 bg-gradient-to-r from-muted-foreground/10 via-muted-foreground/30 to-muted-foreground/10" />
                        <CardHeader className="py-2.5 px-4 bg-muted/20 border-b border-border/40">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                              <CalendarDays className="size-3.5 text-muted-foreground/50" />
                              Semana de {fmtWeekRange(weekId)}
                            </CardTitle>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground/60 tabular-nums">
                                {weekItems.length} aula{weekItems.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0 divide-y divide-border/40">
                          {sortedDays.map(dayKey => {
                            const dayItems = dayGroups[dayKey];
                            const hoje = new Date().toISOString().slice(0, 10) === dayKey;

                            return (
                              <div key={dayKey}>
                                <div className={`px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 ${hoje ? "bg-primary/[0.06] text-primary" : "bg-muted/10 text-muted-foreground"}`}>
                                  <div className={`size-1.5 rounded-full ${hoje ? "bg-primary" : "bg-muted-foreground/30"}`} />
                                  <span>{fmtDay(dayKey)}</span>
                                  {hoje && <Badge className="text-[9px] h-4 px-1.5 bg-primary text-primary-foreground">HOJE</Badge>}
                                </div>
                                <div className="divide-y divide-border/20">
                                  {dayItems.map(a => {
                                    const duracaoLabel = a.duracao !== 60 ? `${a.duracao}min` : "";

                                    return (
                                      <div
                                        key={a.id}
                                        className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto] gap-3 px-4 py-2.5 items-center text-sm hover:bg-muted/20 transition-colors"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-[56px]">
                                          <span className="font-mono text-sm font-semibold">{a.horario}</span>
                                          {duracaoLabel && <span className="text-muted-foreground text-[10px]">({duracaoLabel})</span>}
                                        </div>
                                        <div className="truncate min-w-0">
                                          <span className="text-muted-foreground text-[10px] block leading-tight uppercase tracking-wider">Sala</span>
                                          <span className="font-medium truncate block text-sm">{a.sala.nome}</span>
                                        </div>
                                        <div className="truncate min-w-0">
                                          <span className="text-muted-foreground text-[10px] block leading-tight uppercase tracking-wider">Professor</span>
                                          <span className="font-medium truncate block text-sm">{a.professor.usuario.nome}</span>
                                        </div>
                                        <div className="truncate min-w-0">
                                          <span className="text-muted-foreground text-[10px] block leading-tight uppercase tracking-wider">Aluno</span>
                                          <span className="font-medium truncate block text-sm">{a.aluno.usuario.nome}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {a.valor != null && (
                                            <span className="text-xs font-mono text-muted-foreground">
                                              {a.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                            </span>
                                          )}
                                          <Badge className={`${statusBadge[a.status]} text-[10px] px-2 py-0.5 shrink-0`}>{statusLabel[a.status]}</Badge>
                                        </div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="size-7 p-0 shrink-0 self-center rounded-md hover:bg-muted/50">
                                              <MoreHorizontal className="size-3.5" />
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
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
          {section === "salas" ? <Building2 className="size-12 mb-4" /> :
           section === "professores" ? <GraduationCap className="size-12 mb-4" /> :
           <BookUser className="size-12 mb-4" />}
          <p className="text-sm font-medium text-muted-foreground/70">Nenhum registro encontrado</p>
          <p className="text-xs text-muted-foreground/40 mt-1">
            {section === "salas" ? "Nenhuma sala cadastrada" :
             section === "professores" ? "Nenhum professor cadastrado" :
             "Nenhum aluno cadastrado"}
          </p>
        </div>
      );
    }

    const podeEditar = user?.role === "ADMIN";

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/40 hover:bg-transparent">
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 h-10 pl-5">Nome</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 h-10">{section === "salas" ? "Capacidade" : "Email"}</TableHead>
              {podeEditar && <TableHead className="w-20 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 h-10 pr-5 text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, i) => (
              <TableRow key={item.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors group">
                <TableCell className="py-3.5 pl-5">
                  <span className="font-medium">{"nome" in item ? item.nome : (item as Professor | Aluno).usuario.nome}</span>
                </TableCell>
                <TableCell className="text-muted-foreground/70 py-3.5 text-sm">
                  {section === "salas" ? (item as Sala).capacidade : (item as Professor | Aluno).usuario.email}
                </TableCell>
                {podeEditar && (
                  <TableCell className="py-3.5 pr-5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="size-7 p-0 rounded-md hover:bg-muted/50 transition-all">
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-32">
                        <DropdownMenuItem onClick={() => openEdit(item)} className="text-xs gap-2 py-1.5">
                          <Pencil className="size-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(item.id, getItemLabel(item))}
                          className="text-xs gap-2 text-destructive focus:text-destructive py-1.5"
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
      </div>
    );
  };

  const renderFinanceiro = () => {
    if (!ganhos) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Wallet className="size-12 mb-4 text-muted-foreground/30" />
          <p>Nenhum dado financeiro encontrado</p>
        </div>
      );
    }

    const fmtValor = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const ocupacaoDiaria = ganhos.aulas.reduce<Record<string, typeof ganhos.aulas>>((acc, a) => {
      const d = a.data.slice(0, 10);
      if (!acc[d]) acc[d] = [];
      acc[d].push(a);
      return acc;
    }, {});

    const diasOrdenados = Object.keys(ocupacaoDiaria).sort().reverse();

    const maxProfessorValor = Math.max(...ganhos.porProfessor.map(p => p.valor), 0);
    const maxMesValor = Math.max(...ganhos.porMes.map(m => m.valor), 0);

    const mesLabels: Record<string, string> = {
      "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
      "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
      "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Resumo financeiro do período selecionado
            </p>
          </div>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-medium">De</Label>
                <Input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} className="h-9 w-40 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-medium">Até</Label>
                <Input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} className="h-9 w-40 text-sm" />
              </div>
              <div className="flex items-center gap-1 pb-0.5 ml-1">
                {["30 dias", "3 meses", "1 ano"].map(label => (
                  <Button key={label} variant="ghost" size="sm" className="h-8 text-xs px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all" onClick={() => {
                    const d = new Date();
                    if (label === "30 dias") d.setMonth(d.getMonth() - 1);
                    else if (label === "3 meses") d.setMonth(d.getMonth() - 3);
                    else d.setFullYear(d.getFullYear() - 1);
                    setFiltroDataInicio(d.toISOString().slice(0, 10));
                    setFiltroDataFim(new Date().toISOString().slice(0, 10));
                  }}>{label}</Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Receita Bruta", value: fmtValor(ganhos.resumo.totalBruto), icon: DollarSign },
            { label: "Aulas Realizadas", value: ganhos.resumo.totalAulas, icon: CalendarDays, suffix: ganhos.resumo.totalAulas === 1 ? " aula" : " aulas" },
            { label: "Horas Totais", value: `${ganhos.resumo.totalHoras}h`, icon: Clock },
            { label: "Média por Aula", value: fmtValor(ganhos.resumo.mediaPorAula), icon: TrendingUp },
          ].map(card => (
            <Card key={card.label} className="shadow-sm border-border/60 overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-muted-foreground/10 via-muted-foreground/30 to-muted-foreground/10" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{card.label}</CardTitle>
                <div className="size-8 rounded-lg bg-muted/50 flex items-center justify-center border border-border/40">
                  <card.icon className="size-4 text-muted-foreground/70" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                {card.suffix && <p className="text-xs text-muted-foreground/60 mt-0.5">{card.suffix}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm border-border/60 overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-muted-foreground/10 via-muted-foreground/30 to-muted-foreground/10" />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground/80">
                <GraduationCap className="size-4" />
                <span className="font-semibold uppercase tracking-wider">Por Professor</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ganhos.porProfessor.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground/50">
                  <GraduationCap className="size-8 mb-2" />
                  <p className="text-sm">Nenhum dado no período</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {ganhos.porProfessor.map(p => (
                    <div key={p.id} className="px-4 py-3.5 space-y-2 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{p.nome}</span>
                        <span className="font-mono text-sm font-semibold tabular-nums">{fmtValor(p.valor)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
                        <span>{p.aulas} aula{p.aulas !== 1 ? "s" : ""}</span>
                        <span className="text-muted-foreground/20">/</span>
                        <span>{p.horas}h</span>
                        <span className="text-muted-foreground/20">/</span>
                        <span>{maxProfessorValor > 0 ? Math.round((p.valor / maxProfessorValor) * 100) : 0}% do total</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-muted-foreground/20 rounded-full transition-all duration-500"
                          style={{ width: `${maxProfessorValor > 0 ? (p.valor / maxProfessorValor) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60 overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-muted-foreground/10 via-muted-foreground/30 to-muted-foreground/10" />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground/80">
                <TrendingUp className="size-4" />
                <span className="font-semibold uppercase tracking-wider">Por Mês</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ganhos.porMes.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground/50">
                  <TrendingUp className="size-8 mb-2" />
                  <p className="text-sm">Nenhum dado no período</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {ganhos.porMes.map(m => {
                    const [ano, mesNum] = m.mes.split("-");
                    const mesLabel = mesLabels[mesNum] || mesNum;
                    return (
                      <div key={m.mes} className="px-4 py-3.5 space-y-2 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{mesLabel} <span className="text-muted-foreground/50">{ano}</span></span>
                          <span className="font-mono text-sm font-semibold tabular-nums">{fmtValor(m.valor)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground/60">
                          <span>{m.aulas} aula{m.aulas !== 1 ? "s" : ""}</span>
                          <span className="tabular-nums">{maxMesValor > 0 ? Math.round((m.valor / maxMesValor) * 100) : 0}% do maior mês</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-muted-foreground/20 rounded-full transition-all duration-500"
                            style={{ width: `${maxMesValor > 0 ? (m.valor / maxMesValor) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-border/60 overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-muted-foreground/10 via-muted-foreground/30 to-muted-foreground/10" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground/80">
              <CalendarClock className="size-4" />
              <span className="font-semibold uppercase tracking-wider">Ocupação Diária</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {diasOrdenados.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground/50">
                <CalendarDays className="size-8 mb-2" />
                <p className="text-sm">Nenhuma aula no período</p>
              </div>
            ) : (
              <div className="space-y-3">
                {diasOrdenados.map(dia => {
                  const aulas = ocupacaoDiaria[dia];
                  const totalDia = aulas.reduce((s, a) => s + (a.valor ?? 0), 0);
                  const hoje = new Date().toISOString().slice(0, 10) === dia;
                  return (
                    <div key={dia} className={`rounded-xl border ${hoje ? "border-foreground/20 bg-muted/5" : "border-border/50"} overflow-hidden transition-all`}>
                      <div className={`px-4 py-2.5 flex items-center justify-between ${hoje ? "bg-muted/20" : "bg-muted/10"}`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`size-2 rounded-full ${hoje ? "bg-foreground" : "bg-muted-foreground/20"}`} />
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold capitalize">{new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" })}</span>
                            <span className="text-sm text-muted-foreground/60">{new Date(dia + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                          </div>
                          {hoje && (
                            <div className="text-[10px] font-semibold uppercase tracking-wider bg-foreground text-background px-1.5 py-0.5 rounded">Hoje</div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground/60">
                            {aulas.length} aula{aulas.length !== 1 ? "s" : ""}
                          </span>
                          <span className="font-semibold font-mono tabular-nums">{fmtValor(totalDia)}</span>
                        </div>
                      </div>
                      <div className="divide-x divide-border/30 grid grid-flow-col auto-cols-fr">
                        {aulas.map(a => (
                          <div key={a.id} className="px-3 py-3 space-y-1.5 text-xs hover:bg-muted/10 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-semibold text-sm tabular-nums">{a.horario}</span>
                              <span className="text-muted-foreground/50 font-mono text-[11px]">{a.valor != null ? fmtValor(a.valor) : "—"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground/60">
                              <GraduationCap className="size-3 shrink-0" />
                              <span className="truncate">{a.professor.usuario.nome}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground/60">
                              <BookUser className="size-3 shrink-0" />
                              <span className="truncate">{a.aluno.usuario.nome}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground/60">
                              <Building2 className="size-3 shrink-0" />
                              <span className="truncate">{a.sala.nome}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" min={0} value={form.valor} onChange={e => handleFormField("valor", e.target.value)} placeholder="0,00" />
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
            <div className="col-span-2 bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              <p className="font-semibold mb-1.5 flex items-center gap-1.5"><AlertTriangle className="size-3.5" /> Conflito de horário:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-destructive/80">{conflitos.map((c, i) => <li key={i}>{c}</li>)}</ul>
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
      <>
        <div className="h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800/20 via-transparent to-transparent" />
        <div className="w-full max-w-sm mx-auto p-8 relative">
          <Card className="border-neutral-800/50 bg-neutral-900/60 backdrop-blur-xl shadow-2xl">
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-3 mb-8">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center shadow-lg">
                  <Music className="size-7 text-white" />
                </div>
                <div className="text-center">
                  <h1 className="text-xl font-bold text-white tracking-tight">Acordes Music</h1>
                  <p className="text-sm text-white/50 mt-0.5">Faça login para continuar</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-white/60 text-xs font-medium uppercase tracking-wider">Email</Label>
                  <Input
                    type="email"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 h-10 focus-visible:ring-white/20 focus-visible:border-white/30 transition-all"
                    placeholder="Digite seu email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/60 text-xs font-medium uppercase tracking-wider">Senha</Label>
                  <div className="relative">
                    <Input
                      type={showSenha ? "text" : "password"}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 h-10 pr-10 focus-visible:ring-white/20 focus-visible:border-white/30 transition-all"
                      placeholder="Digite sua senha"
                      value={loginSenha}
                      onChange={e => setLoginSenha(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                      tabIndex={-1}
                    >
                      {showSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                {loginError && (
                  <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2.5">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setRecuperarSenhaDialogOpen(true); setLoginError(""); setRecuperarSenhaMessage(null); setRecuperarSenhaEmail(""); }}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors self-start -mt-1"
                >
                  Esqueceu a senha?
                </button>
                <Button className="w-full h-10 bg-white text-black hover:bg-white/90 hover:shadow-lg transition-all font-medium" onClick={handleLogin} disabled={loginLoading}>
                  {loginLoading ? (
                    <span className="flex items-center gap-2"><span className="size-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> Entrando...</span>
                  ) : "Entrar"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-white/20 mt-6">Sistema de Gestão de Escolas de Música</p>
        </div>
      </div>
      <Dialog open={recuperarSenhaDialogOpen} onOpenChange={v => { setRecuperarSenhaDialogOpen(v); setRecuperarSenhaMessage(v ? recuperarSenhaMessage : null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>Digite seu email para redefinir a senha. A senha será redefinida para 1234.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="Digite seu email"
                value={recuperarSenhaEmail}
                onChange={e => setRecuperarSenhaEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRecuperarSenha()}
              />
            </div>
            {recuperarSenhaMessage && (
              <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2.5 ${recuperarSenhaMessage.startsWith("Senha") ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" : "text-red-400 bg-red-400/10 border border-red-400/20"}`}>
                <span>{recuperarSenhaMessage}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRecuperarSenhaDialogOpen(false); setRecuperarSenhaMessage(null); }}>Cancelar</Button>
            <Button onClick={handleRecuperarSenha} disabled={recuperarSenhaLoading}>
              {recuperarSenhaLoading ? "Enviando..." : "Redefinir senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="size-6 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      <aside className={`${sidebarCollapsed ? "w-16" : "w-60"} transition-all duration-300 bg-neutral-950 text-white flex flex-col shrink-0 ${sidebarCollapsed ? "overflow-hidden" : ""} relative`}>
        <div className={`absolute inset-0 bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900/80 pointer-events-none`} />
        <div className={`h-14 border-b border-white/[0.06] flex items-center gap-2.5 ${sidebarCollapsed ? "justify-center px-0" : "px-3"} relative z-10`}>
          <div className="size-8 rounded-xl bg-gradient-to-br from-neutral-600 to-neutral-800 flex items-center justify-center shrink-0">
            <Music className="size-4 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold tracking-tight truncate text-sm leading-tight">Acordes Music</span>
              <span className="text-[10px] text-white/30 font-medium tracking-wide">Sistema de Gestão</span>
            </div>
          )}
        </div>
        <nav className={`flex-1 p-2 space-y-0.5 ${sidebarCollapsed ? "overflow-hidden" : "overflow-auto"} relative z-10`}>
          <div className="text-[10px] text-white/30 font-semibold uppercase tracking-widest px-2 pb-1.5 pt-1">
            {!sidebarCollapsed && "Navegação"}
          </div>
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = section === t.value;
            return (
              <Button
                key={t.value}
                variant="ghost"
                className={`w-full justify-start gap-3 text-sm font-normal transition-all rounded-lg relative ${
                  sidebarCollapsed ? "h-10 px-0 justify-center" : "h-9 px-3"
                } ${
                  isActive
                    ? "text-white bg-white/15"
                    : "text-white/40 hover:text-white hover:bg-white/10"
                }`}
                onClick={() => { setSection(t.value); setDialogOpen(false); }}
              >
                {isActive && !sidebarCollapsed && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-white/60" />
                )}
                <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                  isActive
                    ? "bg-white/20"
                    : ""
                }`}>
                  <Icon className="size-4" />
                </div>
                {!sidebarCollapsed && (
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className={`text-sm leading-tight ${isActive ? "font-medium" : ""}`}>{t.label}</span>
                  </div>
                )}
                {isActive && !sidebarCollapsed && (
                  <div className="size-1.5 rounded-full bg-white/50" />
                )}
              </Button>
            );
          })}
        </nav>
        {section === "agendamentos" && !sidebarCollapsed && (
          <div className="px-3 py-3 space-y-3 border-t border-white/[0.06] relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-5 rounded-md bg-white/5 flex items-center justify-center">
                <ListFilter className="size-3 text-white/40" />
              </div>
              <span className="text-[10px] text-white/40 font-semibold uppercase tracking-widest">Filtros</span>
              {(filterStatus || filterSala) && (
                <div className="ml-auto size-1.5 rounded-full bg-white/40 animate-pulse" />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                <button
                  className={`text-xs px-2.5 py-1 rounded-md transition-all cursor-pointer ${!filterStatus ? "bg-white/12 text-white shadow-xs" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                  onClick={() => setFilterStatus("")}
                >Todos</button>
                {["AGENDADO", "CONCLUIDO"].map(s => (
                  <button
                    key={s}
                    className={`text-xs px-2.5 py-1 rounded-md transition-all cursor-pointer ${filterStatus === s ? "bg-white/12 text-white shadow-xs" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                    onClick={() => setFilterStatus(s)}
                  >{statusLabel[s]}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Select value={filterSala || "todas"} onValueChange={v => setFilterSala(v === "todas" ? "" : v)}>
                <SelectTrigger className="w-full h-8 text-xs bg-white/[0.03] border-white/[0.08] text-white/60 hover:bg-white/[0.06] hover:border-white/20 transition-all rounded-lg">
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
          <div className="px-1 py-2 border-t border-white/[0.06] flex justify-center relative z-10">
            <button
              className="relative size-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => setSidebarCollapsed(false)}
              title="Filtros"
            >
              <ListFilter className="size-4" />
              {(filterStatus || filterSala) && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-white/40 ring-2 ring-neutral-950" />
              )}
            </button>
          </div>
        )}
        <div className="mt-auto relative z-10">
          <div className="px-3 py-3 border-t border-white/[0.06] bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent">
            {!sidebarCollapsed ? (
              <>
                <button
                  className="flex items-center gap-3 w-full rounded-lg px-2 py-2 hover:bg-white/[0.04] transition-colors group cursor-pointer"
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
                  <div className="size-8 rounded-full bg-gradient-to-br from-neutral-500 to-neutral-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{user?.nome?.charAt(0)?.toUpperCase() || "U"}</span>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 text-left">
                    <span className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">{user?.nome}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/30 capitalize">{user?.role?.toLowerCase() === "admin" ? "Administrador" : "Professor"}</span>
                    </div>
                  </div>
                  <div className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    user?.role === "ADMIN" ? "bg-white/15 text-white/80" : "bg-white/10 text-white/60"
                  }`}>
                    {user?.role === "ADMIN" ? "Admin" : "Prof"}
                  </div>
                </button>
                <div className="flex gap-1 items-center mt-2">
                  {user?.role === "PROFESSOR" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-[11px] text-white/40 hover:text-white hover:bg-white/10 shrink-0 rounded-lg gap-1.5"
                      onClick={() => { setSenhaForm({ senhaAtual: "", senhaNova: "", confirmar: "" }); setSenhaDialogOpen(true); }}
                      title="Alterar senha"
                    >
                      <span className="text-xs font-bold">#</span>
                      Senha
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-[11px] text-white/40 hover:text-white hover:bg-white/10 shrink-0 rounded-lg gap-1.5"
                    onClick={handleLogout}
                    title="Sair"
                  >
                    <LogOut className="size-3" />
                    Sair
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-white/30 hover:text-white hover:bg-white/10 shrink-0 rounded-lg ml-auto"
                    onClick={() => setSidebarCollapsed(p => !p)}
                    title="Recolher"
                  >
                    <PanelLeftClose className="size-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button
                  className="size-9 rounded-full bg-gradient-to-br from-neutral-500 to-neutral-700 flex items-center justify-center shrink-0 hover:ring-2 hover:ring-white/20 transition-all cursor-pointer"
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
                  <span className="text-xs font-bold text-white">{user?.nome?.charAt(0)?.toUpperCase() || "U"}</span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-white/30 hover:text-white hover:bg-white/10 shrink-0 rounded-lg"
                  onClick={() => setSidebarCollapsed(p => !p)}
                  title="Expandir"
                >
                  <PanelLeftOpen className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
        <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {section === "financeiro" ? renderFinanceiro() : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">
                        {section === "salas" ? "Salas" :
                         section === "professores" ? "Professores" :
                         section === "alunos" ? "Alunos" : "Agendamentos"}
                      </h1>
                      <p className="text-sm text-muted-foreground mt-1">
                        {section === "salas" ? "Gerencie as salas de aula" :
                         section === "professores" ? "Gerencie os professores" :
                         section === "alunos" ? "Gerencie os alunos" : "Acompanhe os agendamentos"}
                      </p>
                    </div>
                    {(user?.role === "ADMIN" || section === "agendamentos") && (
                      <Button size="sm" onClick={openCreate} className="shadow-xs">
                        <Plus className="size-3.5" /> Novo
                      </Button>
                    )}
                  </div>
                  <div className="relative max-w-sm">
                    <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      className="w-full h-9 pl-9 text-sm bg-background/80 border-border/50 focus-visible:bg-background transition-all"
                      placeholder={section === "salas" ? "Buscar por nome..." : section === "agendamentos" ? "Buscar por sala, professor, aluno..." : "Buscar por nome, email ou CPF..."}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Card className="border-border/60 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                      {renderTable()}
                    </CardContent>
                  </Card>
                </div>
              )}
          </div>
        </main>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="flex flex-row items-start gap-3">
            <div className="rounded-full bg-destructive/10 p-2 shrink-0 mt-0.5">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Confirmar exclusão</DialogTitle>
              <DialogDescription className="mt-1">
                Tem certeza que deseja excluir <strong>{deletingItem?.label}</strong>? Esta ação não pode ser desfeita.
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} className="shadow-xs">Excluir</Button>
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
              <DialogDescription className="mt-1">{error}</DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setErrorDialogOpen(false); setError(null); }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                {section === "salas" ? <Building2 className="size-4.5 text-primary" /> :
                 section === "professores" ? <GraduationCap className="size-4.5 text-primary" /> :
                 section === "alunos" ? <BookUser className="size-4.5 text-primary" /> :
                 <CalendarDays className="size-4.5 text-primary" />}
              </div>
              <div>
                <DialogTitle>{editingId ? "Editar" : "Novo"} {section === "salas" ? "Sala" : section === "professores" ? "Professor" : section === "alunos" ? "Aluno" : "Agendamento"}</DialogTitle>
              </div>
            </div>
          </DialogHeader>
          {error && (
            <div className="mx-6 flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="px-6 pb-6">{renderFormFields()}</div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={section === "agendamentos" && conflitos.length > 0} className="shadow-xs">
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={senhaDialogOpen} onOpenChange={v => { setSenhaDialogOpen(v); if (!v) setSenhaForm({ senhaAtual: "", senhaNova: "", confirmar: "" }); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">#</span>
              </div>
              <div>
                <DialogTitle>Alterar senha</DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Senha atual</Label>
              <Input type="password" value={senhaForm.senhaAtual} onChange={e => setSenhaForm(p => ({ ...p, senhaAtual: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nova senha</Label>
              <Input type="password" value={senhaForm.senhaNova} onChange={e => setSenhaForm(p => ({ ...p, senhaNova: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Confirmar nova senha</Label>
              <Input type="password" value={senhaForm.confirmar} onChange={e => setSenhaForm(p => ({ ...p, confirmar: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSenhaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAlterarSenha} className="shadow-xs">Alterar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={perfilDialogOpen} onOpenChange={v => { setPerfilDialogOpen(v); if (!v) setPerfilForm({ nome: "", email: "", telefone: "" }); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="size-4.5 text-primary" />
              </div>
              <div>
                <DialogTitle>Editar Perfil</DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome</Label>
              <Input value={perfilForm.nome} onChange={e => setPerfilForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <Input type="email" value={perfilForm.email} onChange={e => setPerfilForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Telefone</Label>
              <Input value={perfilForm.telefone} onChange={e => setPerfilForm(p => ({ ...p, telefone: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPerfilDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditarPerfil} disabled={perfilLoading} className="shadow-xs">
              {perfilLoading ? "Salvando..." : "Salvar"}
            </Button>
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
