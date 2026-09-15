// Modelo de permisos compartido por servidor (API) y cliente (UI). Sin dependencias de Node ni de React.
//
//  - admin:  todo.
//  - user con SU propia API key: control total de sus servidores (es su cuenta), pero no administra el panel.
//  - user aprobado con la key del ADMIN: operar (comandos normales, give, inventario, teleport, whitelist,
//    ver config/archivos, copias) pero NO administrar (encender/apagar, RAM/MOTD, editar config/archivos,
//    OPs/bans, comandos peligrosos, ajustes de copias).

export type Role = "admin" | "user";

export type Perm =
  | "server.power"       // iniciar / detener / reiniciar
  | "server.options"     // RAM y MOTD
  | "config.write"       // editar server.properties y otros configs
  | "files.write"        // subir, editar, borrar archivos
  | "players.ops"        // dar/quitar OP
  | "players.bans"       // banear / desbanear
  | "command.dangerous"  // comandos de consola peligrosos (ver DANGEROUS)
  | "backup.settings"    // activar/desactivar copias, intervalo
  | "app.admin";         // aprobar usuarios, roles, auditoria

const ALL: Perm[] = ["server.power", "server.options", "config.write", "files.write", "players.ops", "players.bans", "command.dangerous", "backup.settings", "app.admin"];
const PANEL_ONLY: Perm[] = ["app.admin", "backup.settings"];

export function permissionsFor(role: Role, ownKey: boolean): Set<Perm> {
  if (role === "admin") return new Set(ALL);
  if (ownKey) return new Set(ALL.filter((p) => !PANEL_ONLY.includes(p)));
  return new Set(); // usuario normal con la key del admin: solo operar
}

export const PERM_LABEL: Record<Perm, string> = {
  "server.power": "encender/apagar el servidor",
  "server.options": "cambiar RAM o MOTD",
  "config.write": "editar la configuracion",
  "files.write": "modificar archivos",
  "players.ops": "gestionar operadores",
  "players.bans": "gestionar baneos",
  "command.dangerous": "ejecutar comandos peligrosos",
  "backup.settings": "cambiar los ajustes de copias",
  "app.admin": "administrar usuarios",
};

// ---- Comandos de consola peligrosos (requieren command.dangerous) ----
// Raices de comando reservadas al admin
const DANGEROUS_ROOTS = new Set([
  "op", "deop", "ban", "ban-ip", "pardon", "pardon-ip", "banlist",
  "stop", "save-off", "save-on", "reload", "debug", "perf", "jfr",
  "whitelist", "difficulty", "gamerule", "defaultgamemode", "setworldspawn", "worldborder",
  "datapack", "function", "fill", "clone", "setblock", "forceload", "kill", "clear",
]);
// Excepciones: estas formas son de uso normal y se permiten a cualquier usuario
const ALLOWED_FORMS: RegExp[] = [
  /^whitelist (add|remove|list) /i, /^whitelist list$/i,
  /^kill (?!@a\b|@e\b)\S+$/i,          // matar a un jugador concreto si, a todos/entidades no
  /^clear (?!@a\b|@e\b)\S+( .*)?$/i,  // vaciar inventario de un jugador concreto si
];

export function isDangerousCommand(command: string): boolean {
  const c = command.trim().replace(/^\//, "");
  // "execute ... run <cmd>" se evalua por el comando final
  const inner = c.match(/\brun\s+(.+)$/i)?.[1] ?? c;
  const root = inner.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!DANGEROUS_ROOTS.has(root)) return false;
  return !ALLOWED_FORMS.some((re) => re.test(inner));
}

export function describeDenied(perm: Perm) {
  return `Solo un administrador puede ${PERM_LABEL[perm]}.`;
}
