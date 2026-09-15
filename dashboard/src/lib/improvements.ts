// Mejoras del servidor: interruptores que se traducen en comandos vanilla (scoreboards y gamerules de 26.x).
// Compartido entre servidor (lee/aplica) y cliente (muestra). Sin dependencias de Node.

export type Improvement = {
  id: string;
  label: string;
  desc: string;
  group: "tab" | "rules";
  /** comandos para activar */
  on: string[];
  /** comandos para desactivar */
  off: string[];
  /** comando para leer el estado (se ejecuta en lote) */
  read: string;
  /** dado el conjunto de lineas de respuesta, devuelve true/false o null si no se pudo determinar */
  parse: (lines: string[]) => boolean | null;
  /** aviso: cambia el balance del juego */
  gameplay?: boolean;
};

const gamerule = (name: string, onValue: "true" | "false"): Pick<Improvement, "on" | "off" | "read" | "parse"> => ({
  on: [`gamerule ${name} ${onValue}`],
  off: [`gamerule ${name} ${onValue === "true" ? "false" : "true"}`],
  read: `gamerule ${name}`,
  parse: (lines) => {
    const l = lines.find((x) => new RegExp(`Gamerule ${name} is currently set to: `).test(x));
    if (!l) return null;
    return l.trim().endsWith(onValue);
  },
});

// Un objetivo de scoreboard existe si aparece en "scoreboard objectives list"
const objective = (name: string, display: string, criterion: string, title: string): Pick<Improvement, "on" | "off" | "read" | "parse"> => ({
  on: [`scoreboard objectives add ${name} ${criterion} "${title}"`, `scoreboard objectives setdisplay ${display} ${name}`],
  off: [`scoreboard objectives setdisplay ${display}`, `scoreboard objectives remove ${name}`],
  read: "scoreboard objectives list",
  parse: (lines) => {
    const l = lines.find((x) => /objective\(s\)|no objectives/i.test(x));
    if (!l) return null;
    return new RegExp(`\\[${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`).test(l) || new RegExp(`\\[${name}\\]`).test(l);
  },
});

export const IMPROVEMENTS: Improvement[] = [
  { id: "deaths_tab", label: "Contador de muertes en Tab", desc: "Al pulsar Tab se ve cuantas veces ha muerto cada jugador.", group: "tab",
    ...objective("muertes", "list", "deathCount", "Muertes") },
  { id: "kills_sidebar", label: "Ranking de kills PvP (lateral)", desc: "Tabla a la derecha con las muertes de jugadores causadas por cada jugador.", group: "tab",
    ...objective("kills", "sidebar", "playerKillCount", "Kills") },
  { id: "health_name", label: "Vida bajo el nombre", desc: "Muestra los puntos de vida debajo del nombre de cada jugador.", group: "tab",
    ...objective("vida", "below_name", "health", "❤") },
  { id: "no_phantoms", label: "Sin phantoms", desc: "Los phantoms no aparecen aunque nadie duerma.", group: "rules",
    ...gamerule("spawn_phantoms", "false") },
  { id: "keep_inventory", label: "Conservar inventario al morir", desc: "No se pierden objetos ni experiencia al morir.", group: "rules", gameplay: true,
    ...gamerule("keep_inventory", "true") },
  { id: "no_griefing", label: "Mobs no destruyen bloques", desc: "Creepers, endermen, ghasts... no rompen el mundo (tampoco los aldeanos cosechan).", group: "rules", gameplay: true,
    ...gamerule("mob_griefing", "false") },
  { id: "immediate_respawn", label: "Reaparecer sin pantalla de muerte", desc: "Al morir reapareces al instante.", group: "rules",
    ...gamerule("immediate_respawn", "true") },
  { id: "pvp", label: "PvP", desc: "Los jugadores pueden hacerse dano entre si.", group: "rules", gameplay: true,
    ...gamerule("pvp", "true") },
  { id: "day_cycle", label: "Ciclo de dia y noche", desc: "Si se desactiva, la hora se congela.", group: "rules",
    ...gamerule("advance_time", "true") },
  { id: "weather_cycle", label: "Ciclo de clima", desc: "Si se desactiva, el clima se congela.", group: "rules",
    ...gamerule("advance_weather", "true") },
];

export const byId = (id: string) => IMPROVEMENTS.find((i) => i.id === id);
