/**
 * AI Tool Registry
 * ----------------
 * Frontend allowlist for MCP tools. Anything not present here defaults to
 * `disabled` and cannot be invoked from the UI, even if the MCP server
 * advertises it. Clinical tools stay `clinical-restricted` until consent,
 * audit logging, and access-control rules are in place.
 */

export type ToolCategory =
  | "public"
  | "authenticated"
  | "administrative"
  | "clinical-restricted"
  | "disabled";

export type ToolSensitivity = "none" | "operational" | "clinical";

export interface RegisteredTool {
  name: string;
  label: string;
  description: string;
  category: ToolCategory;
  sensitivity: ToolSensitivity;
  requiresConfirmation: boolean;
  requiresAudit: boolean;
  involvesClinicalData: boolean;
  enabled: boolean;
  requiredRole?: "admin" | "moderator" | "user";
}

const TOOLS: RegisteredTool[] = [
  {
    name: "whoami",
    label: "Quem sou eu",
    description: "Retorna a identidade do usuário autenticado. Não expõe PHI.",
    category: "authenticated",
    sensitivity: "operational",
    requiresConfirmation: false,
    requiresAudit: false,
    involvesClinicalData: false,
    enabled: true,
  },
  {
    name: "health",
    label: "Health check",
    description: "Verifica se o servidor MCP está disponível.",
    category: "public",
    sensitivity: "none",
    requiresConfirmation: false,
    requiresAudit: false,
    involvesClinicalData: false,
    enabled: true,
  },
  {
    name: "ping",
    label: "Ping",
    description: "Sondagem mínima de conectividade.",
    category: "public",
    sensitivity: "none",
    requiresConfirmation: false,
    requiresAudit: false,
    involvesClinicalData: false,
    enabled: true,
  },
  {
    name: "app_status",
    label: "Status da aplicação",
    description: "Retorna status operacional agregado (sem PHI).",
    category: "authenticated",
    sensitivity: "operational",
    requiresConfirmation: false,
    requiresAudit: false,
    involvesClinicalData: false,
    enabled: true,
  },
  {
    name: "integration_health",
    label: "Saúde da integração",
    description: "Verifica integrações auxiliares (sem PHI).",
    category: "authenticated",
    sensitivity: "operational",
    requiresConfirmation: false,
    requiresAudit: false,
    involvesClinicalData: false,
    enabled: true,
  },
  {
    name: "open_module",
    label: "Abrir módulo",
    description: "Comando de navegação para módulos do app.",
    category: "authenticated",
    sensitivity: "operational",
    requiresConfirmation: false,
    requiresAudit: true,
    involvesClinicalData: false,
    enabled: true,
  },
  {
    name: "navigation_command",
    label: "Comando de navegação",
    description: "Executa comandos de navegação seguros.",
    category: "authenticated",
    sensitivity: "operational",
    requiresConfirmation: false,
    requiresAudit: true,
    involvesClinicalData: false,
    enabled: true,
  },
  {
    name: "get_public_config",
    label: "Config pública",
    description: "Retorna feature flags e configuração não sensível.",
    category: "public",
    sensitivity: "none",
    requiresConfirmation: false,
    requiresAudit: false,
    involvesClinicalData: false,
    enabled: true,
  },
  // --- Clinical-restricted (never callable from the frontend today) ---
  {
    name: "list_patients",
    label: "Listar pacientes",
    description: "Contém PHI. Desativado até consentimento e auditoria.",
    category: "clinical-restricted",
    sensitivity: "clinical",
    requiresConfirmation: true,
    requiresAudit: true,
    involvesClinicalData: true,
    enabled: false,
    requiredRole: "admin",
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function getRegisteredTool(name: string): RegisteredTool | undefined {
  return BY_NAME.get(name);
}

export function listRegisteredTools(): RegisteredTool[] {
  return [...TOOLS];
}

/** Tool is safe to expose in the operational admin UI. */
export function isSafeOperationalTool(name: string): boolean {
  const t = BY_NAME.get(name);
  return Boolean(t && t.enabled && !t.involvesClinicalData);
}

/** Tool may be invoked from the frontend right now. */
export function isInvocable(name: string): boolean {
  const t = BY_NAME.get(name);
  if (!t) return false; // unknown → disabled by default
  if (!t.enabled) return false;
  if (t.category === "clinical-restricted" || t.category === "disabled") return false;
  return true;
}
