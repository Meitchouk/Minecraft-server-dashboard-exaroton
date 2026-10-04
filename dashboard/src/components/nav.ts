import {
  LayoutDashboard, TerminalSquare, Zap, Gavel, MessageSquareHeart, BarChart3, Settings2, Users, FolderTree, Puzzle, SlidersHorizontal, UserRound,
} from "lucide-react";

// Secciones del panel (menu lateral y paleta de comandos)
export const NAV = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/console", label: "Consola", icon: TerminalSquare },
  { href: "/commands", label: "Comandos", icon: Zap },
  { href: "/discipline", label: "Castigos y premios", icon: Gavel },
  { href: "/messages", label: "Mensajes", icon: MessageSquareHeart },
  { href: "/stats", label: "Estadisticas", icon: BarChart3 },
  { href: "/config", label: "Configuracion", icon: Settings2 },
  { href: "/players", label: "Jugadores", icon: Users },
  { href: "/profile", label: "Ficha de jugador", icon: UserRound },
  { href: "/files", label: "Archivos", icon: FolderTree },
  { href: "/mods", label: "Mods", icon: Puzzle },
  { href: "/settings", label: "Ajustes", icon: SlidersHorizontal },
];

// Pestañas de Comandos (enlaces directos)
export const COMMAND_TABS = [
  { tab: "quick", label: "Comandos rapidos" }, { tab: "give", label: "Give" }, { tab: "modgive", label: "Give mods" },
  { tab: "inv", label: "Inventario" }, { tab: "kits", label: "Kits" }, { tab: "tp", label: "Teleport" }, { tab: "effects", label: "Efectos" },
  { tab: "summon", label: "Invocar" }, { tab: "improve", label: "Mejoras del servidor" }, { tab: "favs", label: "Favoritos" },
];
