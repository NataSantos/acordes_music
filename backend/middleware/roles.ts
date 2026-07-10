import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Acesso restrito a administradores" });
  }
  next();
}

export function requireAdminOrProfessor(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN" && req.user?.role !== "PROFESSOR") {
    return res.status(403).json({ error: "Acesso restrito a administradores e professores" });
  }
  next();
}

export function requireAdminOrProfessorOrAluno(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN" && req.user?.role !== "PROFESSOR" && req.user?.role !== "ALUNO") {
    return res.status(403).json({ error: "Acesso restrito" });
  }
  next();
}
