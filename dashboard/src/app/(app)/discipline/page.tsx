"use client";
import { useState } from "react";
import { Gavel, Shrink, MessageSquare, Hand, Box, Ear, Feather, Swords, Footprints, Dog, Laugh, Wand, Bell, Cat, Eye, Tornado, Music, RotateCcw, Rocket, PiggyBank, Fish, Hourglass, Expand, Moon, Star, Waves, Cake, Tag, Bomb, Trophy, Skull, Flame, EyeOff, Snail, Frown, Utensils, ArrowUp, Lock, Ban, UserX, Eraser, ShieldMinus, Ghost, Mountain, Sparkles, Gem, Apple, Heart, Zap, PartyPopper, Megaphone, ShieldPlus, Coins, ScrollText, AlertTriangle, Anchor, Snowflake, Bird, Drama, Beef, Pickaxe, Wind, Crown, ArrowDownToLine, Volume2, Rabbit, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TargetPicker } from "@/components/target-picker";
import { CommandProvider, useCommands } from "@/components/command-runner";
import { useServer } from "@/hooks/use-server";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { isDangerousCommand } from "@/lib/permissions";
import { AdminBadge } from "@/components/admin-only";

// {t} = objetivo, {m} = motivo/mensaje escrito por el admin
type Tier = "leve" | "medio" | "grave" | "pequeno" | "especial" | "sonido" | "broma" | "cuerpo" | "chat";
type Action = { label: string; desc: string; icon: React.ElementType; cmds: string[]; danger?: boolean; confirm?: boolean; needsMsg?: boolean; tier: Tier };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const tell = (t: string, text: string, color: string) => `tellraw ${t} {"text":"${esc(text)}","color":"${color}","bold":true}`;
const title = (t: string, text: string, color: string, sub?: string) => [
  `title ${t} times 10 70 20`,
  ...(sub ? [`title ${t} subtitle {"text":"${esc(sub)}","color":"gray"}`] : []),
  `title ${t} title {"text":"${esc(text)}","color":"${color}","bold":true}`,
];

const PUNISH: Action[] = [
  // ---- leves: molestan, no hacen daño real ----
  { tier: "leve", label: "Advertencia", desc: "Titulo rojo en pantalla + mensaje en chat con el motivo", icon: AlertTriangle, needsMsg: true, cmds: [...title("{t}", "ADVERTENCIA", "red", "{m}"), tell("{t}", "Advertencia del administrador: {m}", "red")] },
  { tier: "leve", label: "Advertencia publica", desc: "Todos ven en el chat que fue advertido y por que", icon: Volume2, needsMsg: true, cmds: [`tellraw @a [{"text":"⚠ ","color":"red"},{"text":"{t}","color":"yellow","bold":true},{"text":" ha sido advertido: {m}","color":"red"}]`] },
  { tier: "leve", label: "Nauseas", desc: "Mareo durante 30 s", icon: Frown, cmds: ["effect give {t} minecraft:nausea 30 0 true"] },
  { tier: "leve", label: "Ceguera", desc: "Ceguera + oscuridad 30 s", icon: EyeOff, cmds: ["effect give {t} minecraft:blindness 30 0 true", "effect give {t} minecraft:darkness 30 0 true"] },
  { tier: "leve", label: "Sin saltar", desc: "No puede saltar durante 60 s", icon: ArrowDownToLine, cmds: ["effect give {t} minecraft:jump_boost 60 128 true"] },
  { tier: "leve", label: "Lluvia de pollos", desc: "12 pollos le caen encima (inofensivo, ruidoso)", icon: Bird, cmds: Array.from({ length: 12 }, () => "execute at {t} run summon minecraft:chicken ~ ~6 ~") },
  { tier: "leve", label: "Conejos", desc: "8 conejos alrededor para distraer", icon: Rabbit, cmds: Array.from({ length: 8 }, () => "execute at {t} run summon minecraft:rabbit ~ ~1 ~") },
  { tier: "leve", label: "Brillar 5 min", desc: "Todos lo ven a traves de paredes", icon: Sun, cmds: ["effect give {t} minecraft:glowing 300 0 true"] },
  { tier: "leve", label: "Mala suerte 10 min", desc: "Peor botin", icon: Frown, cmds: ["effect give {t} minecraft:unluck 600 0 true"] },
  { tier: "leve", label: "Enano 5 min", desc: "Encoge al 40 % (se revierte con 'Volver a la normalidad')", icon: Shrink, cmds: ["attribute {t} minecraft:scale base set 0.4"] },
  { tier: "leve", label: "Disculpa publica", desc: "Dice en el chat que pide perdon", icon: MessageSquare, cmds: ["execute as {t} run say Perdon a todos, me porte mal"] },
  { tier: "leve", label: "Lanzar al cielo", desc: "Levitacion 5 s y caida suave (no muere)", icon: ArrowUp, cmds: ["effect give {t} minecraft:levitation 5 9 true", "effect give {t} minecraft:slow_falling 25 0 true"] },
  // ---- medios: castigan de verdad pero son reversibles ----
  { tier: "medio", label: "Congelar 20 s", desc: "No puede moverse ni minar", icon: Snowflake, cmds: ["effect give {t} minecraft:slowness 20 255 true", "effect give {t} minecraft:mining_fatigue 20 255 true", "effect give {t} minecraft:jump_boost 20 128 true"] },
  { tier: "medio", label: "Lentitud extrema", desc: "Lentitud V + fatiga de minero 60 s", icon: Snail, cmds: ["effect give {t} minecraft:slowness 60 4 true", "effect give {t} minecraft:mining_fatigue 60 2 true"] },
  { tier: "medio", label: "Debilidad", desc: "Debilidad II + hambre durante 2 min", icon: Utensils, cmds: ["effect give {t} minecraft:weakness 120 1 true", "effect give {t} minecraft:hunger 120 2 true"] },
  { tier: "medio", label: "Envenenar", desc: "Veneno II 20 s (no mata, deja en medio corazon)", icon: Skull, cmds: ["effect give {t} minecraft:poison 20 1 true"] },
  { tier: "medio", label: "Rayo divino", desc: "Le cae un rayo encima (dano + fuego)", icon: Flame, cmds: ["execute at {t} run summon minecraft:lightning_bolt ~ ~ ~"] },
  { tier: "medio", label: "Susto: zombis", desc: "4 zombis a su alrededor", icon: Drama, cmds: Array.from({ length: 4 }, () => "execute at {t} run summon minecraft:zombie ~ ~ ~"), confirm: true },
  { tier: "medio", label: "Al vacio (con red)", desc: "60 bloques arriba con caida lenta", icon: Mountain, cmds: ["execute as {t} at @s run tp @s ~ ~60 ~", "effect give {t} minecraft:slow_falling 30 0 true"] },
  { tier: "medio", label: "Quitar niveles", desc: "Pierde toda la experiencia", icon: Sparkles, confirm: true, cmds: ["xp set {t} 0 levels", "xp set {t} 0 points"] },
  { tier: "medio", label: "Multa: 5 diamantes", desc: "Se le quitan hasta 5 diamantes del inventario", icon: Gem, confirm: true, cmds: ["clear {t} minecraft:diamond 5"] },
  { tier: "medio", label: "Modo aventura", desc: "No puede romper ni poner bloques (revertir con 'Volver a supervivencia')", icon: Lock, cmds: ["gamemode adventure {t}"] },
  { tier: "medio", label: "Modo espectador", desc: "No puede interactuar hasta que lo devuelvas", icon: Ghost, cmds: ["gamemode spectator {t}"] },
  { tier: "medio", label: "Pies de plomo", desc: "Gravedad alta y sin salto hasta que lo reviertas", icon: ArrowDownToLine, cmds: ["attribute {t} minecraft:gravity base set 0.24","attribute {t} minecraft:jump_strength base set 0"] },
  { tier: "medio", label: "Brazos cortos", desc: "Solo alcanza bloques a 1,5", icon: Hand, cmds: ["attribute {t} minecraft:block_interaction_range base set 1.5"] },
  { tier: "medio", label: "Hambre", desc: "Hambre III durante 30 s", icon: Utensils, cmds: ["effect give {t} minecraft:hunger 30 2 true"] },
  { tier: "medio", label: "Jaula de cristal", desc: "Encerrado en cristal (puede romperlo)", icon: Box, cmds: ["execute at {t} align xyz run fill ~-1 ~ ~-1 ~1 ~1 ~-1 minecraft:glass keep","execute at {t} align xyz run fill ~-1 ~ ~1 ~1 ~1 ~1 minecraft:glass keep","execute at {t} align xyz run fill ~-1 ~ ~ ~-1 ~1 ~ minecraft:glass keep","execute at {t} align xyz run fill ~1 ~ ~ ~1 ~1 ~ minecraft:glass keep","execute at {t} align xyz run fill ~-1 ~2 ~-1 ~1 ~2 ~1 minecraft:glass keep","execute at {t} align xyz run fill ~-1 ~-1 ~-1 ~1 ~-1 ~1 minecraft:glass keep"] },
  { tier: "medio", label: "Multa: 10 esmeraldas", desc: "Se le quitan hasta 10 esmeraldas", icon: Coins, cmds: ["clear {t} minecraft:emerald 10"], confirm: true },
  { tier: "medio", label: "Multa: 16 hierro", desc: "Se le quitan hasta 16 lingotes de hierro", icon: Coins, cmds: ["clear {t} minecraft:iron_ingot 16"], confirm: true },
  // ---- graves: irreversibles o de acceso ----
  { tier: "grave", label: "Vaciar inventario", desc: "Borra TODO lo que lleva (queda copia en Inventario > papelera si se hace desde ahi)", icon: Eraser, danger: true, confirm: true, cmds: ["clear {t}"] },
  { tier: "grave", label: "Matar", desc: "Muere al instante (pierde el inventario si keep_inventory esta apagado)", icon: Skull, danger: true, confirm: true, cmds: ["kill {t}"] },
  { tier: "grave", label: "Quitar OP", desc: "Retira permisos de operador", icon: ShieldMinus, danger: true, cmds: ["deop {t}"] },
  { tier: "grave", label: "Expulsar", desc: "Kick con motivo", icon: UserX, danger: true, needsMsg: true, cmds: ["kick {t} {m}"] },
  { tier: "grave", label: "Banear", desc: "Ban permanente con motivo (se quita en Jugadores)", icon: Ban, danger: true, confirm: true, needsMsg: true, cmds: ["ban {t} {m}"] },
];


// Bromas: inofensivas, no quitan vida ni objetos y se pasan solas
const PRANKS: Action[] = [
  // ---- sonidos: solo los oye el objetivo ----
  { tier: "sonido", label: "Creeper a punto", desc: "Siseo de creeper justo detras", icon: Bomb, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.creeper.primed hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Warden", desc: "El Warden emerge a su lado", icon: Ghost, cmds: ["execute at {t} run playsound minecraft:entity.warden.emerge hostile {t} ~ ~ ~ 1 1", "execute at {t} run playsound minecraft:entity.warden.heartbeat hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Explosion", desc: "Estruendo de TNT (sin explosion real)", icon: Flame, cmds: ["execute at {t} run playsound minecraft:entity.generic.explode hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Enderman", desc: "Grito de enderman enfadado detras", icon: EyeOff, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.enderman.scream hostile {t} ^ ^ ^-3 1 1", "execute at {t} run playsound minecraft:entity.enderman.teleport hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Ghast", desc: "Chillido de ghast lejano", icon: Frown, cmds: ["execute at {t} run playsound minecraft:entity.ghast.scream hostile {t} ~ ~ ~ 1 0.8"] },
  { tier: "sonido", label: "Cueva", desc: "Ruido ambiental de cueva (el clasico)", icon: Mountain, cmds: ["execute at {t} run playsound minecraft:ambient.cave hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Pasos de zombi", desc: "Gruñido de zombi y golpe en la puerta", icon: Drama, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.zombie.ambient hostile {t} ^ ^ ^-3 1 1", "execute at {t} run playsound minecraft:entity.zombie.attack_wooden_door hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Elder guardian", desc: "Maldicion del guardian (sonido + imagen, sin efecto)", icon: Skull, cmds: ["execute at {t} run playsound minecraft:entity.elder_guardian.curse hostile {t} ~ ~ ~ 1 1", "particle minecraft:elder_guardian ~ ~ ~ 0 0 0 0 1 force {t}"] },
  { tier: "sonido", label: "Raid", desc: "Cuerno de asalto de illagers", icon: Megaphone, cmds: ["execute at {t} run playsound minecraft:event.raid.horn hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Wither", desc: "Rugido de spawn del Wither", icon: Skull, cmds: ["execute at {t} run playsound minecraft:entity.wither.spawn hostile {t} ~ ~ ~ 0.6 1"] },
  { tier: "sonido", label: "Totem", desc: "Suena y se ve un totem salvandolo (sin gastar nada)", icon: Sparkles, cmds: ["execute at {t} run playsound minecraft:item.totem.use hostile {t} ~ ~ ~ 1 1", "particle minecraft:totem_of_undying ~ ~1 ~ 0.5 1 0.5 0.5 60 force {t}"] },
  { tier: "sonido", label: "Sonic boom", desc: "El rayo sonico del Warden", icon: Zap, cmds: ["execute at {t} run playsound minecraft:entity.warden.sonic_boom hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Warden furioso", desc: "Warden enfadado detras + latidos", icon: Ghost, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.warden.angry hostile {t} ^ ^ ^-3 1 1","execute at {t} run playsound minecraft:entity.warden.heartbeat hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Shrieker", desc: "Un chillador de sculk grita cerca", icon: Ear, cmds: ["execute at {t} rotated as {t} run playsound minecraft:block.sculk_shrieker.shriek hostile {t} ^8 ^ ^-8 1 1"] },
  { tier: "sonido", label: "Phantom", desc: "Un phantom se lanza en picado", icon: Feather, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.phantom.swoop hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Flechazo", desc: "Disparo de esqueleto + flecha que le da", icon: Swords, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.skeleton.shoot hostile {t} ^8 ^ ^-8 1 1","execute at {t} run playsound minecraft:entity.arrow.hit_player hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Araña", desc: "Araña caminando detras", icon: Footprints, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.spider.ambient hostile {t} ^ ^ ^-3 1 1","execute at {t} rotated as {t} run playsound minecraft:entity.spider.step hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Lobo", desc: "Gruñido de lobo muy cerca", icon: Dog, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.wolf.growl hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Bruja", desc: "Risa de bruja", icon: Laugh, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.witch.celebrate hostile {t} ^8 ^ ^-8 1 1"] },
  { tier: "sonido", label: "Vex", desc: "Vex cargando contra el", icon: Wind, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.vex.charge hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Evocador", desc: "Evocador preparando colmillos", icon: Wand, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.evoker.prepare_summon hostile {t} ^8 ^ ^-8 1 1"] },
  { tier: "sonido", label: "Trueno", desc: "Trueno encima (sin rayo)", icon: Zap, cmds: ["execute at {t} run playsound minecraft:entity.lightning_bolt.thunder hostile {t} ~ ~ ~ 0.8 1"] },
  { tier: "sonido", label: "Te abren el cofre", desc: "Sonido de cofre abriendose cerca", icon: Box, cmds: ["execute at {t} rotated as {t} run playsound minecraft:block.chest.open hostile {t} ^ ^ ^-3 1 1","execute at {t} rotated as {t} run playsound minecraft:block.chest.close hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Puerta", desc: "Una puerta se abre detras", icon: Lock, cmds: ["execute at {t} rotated as {t} run playsound minecraft:block.wooden_door.open hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Puerta de hierro", desc: "Puerta de hierro abriendose", icon: Lock, cmds: ["execute at {t} rotated as {t} run playsound minecraft:block.iron_door.open hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Te hacen daño", desc: "Sonido de recibir daño (sin daño)", icon: Heart, cmds: ["execute at {t} run playsound minecraft:entity.player.hurt hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Se rompe tu herramienta", desc: "Sonido de herramienta rota (no se rompe nada)", icon: Pickaxe, cmds: ["execute at {t} run playsound minecraft:entity.item.break hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Portal", desc: "Zumbido de portal del Nether", icon: Sparkles, cmds: ["execute at {t} run playsound minecraft:block.portal.trigger hostile {t} ~ ~ ~ 0.7 1"] },
  { tier: "sonido", label: "Dragon", desc: "Rugido del Ender Dragon", icon: Flame, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.ender_dragon.growl hostile {t} ^8 ^ ^-8 0.8 1"] },
  { tier: "sonido", label: "Pececillo", desc: "Pececillo de plata en las paredes", icon: Footprints, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.silverfish.ambient hostile {t} ^ ^ ^-3 1 1","execute at {t} rotated as {t} run playsound minecraft:entity.silverfish.step hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Quemandose", desc: "Sonido de estar en llamas", icon: Flame, cmds: ["execute at {t} run playsound minecraft:entity.generic.burn hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Yunque", desc: "Un yunque cae a su lado", icon: Bomb, cmds: ["execute at {t} run playsound minecraft:block.anvil.land hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Campana", desc: "Campana de alarma de aldea", icon: Bell, cmds: ["execute at {t} rotated as {t} run playsound minecraft:block.bell.use hostile {t} ^8 ^ ^-8 1 1","execute at {t} rotated as {t} run playsound minecraft:block.bell.use hostile {t} ^8 ^ ^-8 1 0.9"] },
  { tier: "sonido", label: "Gato", desc: "Bufido de gato", icon: Cat, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.cat.hiss hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Zorro", desc: "Chillido de zorro", icon: Laugh, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.fox.screech hostile {t} ^8 ^ ^-8 1 1"] },
  { tier: "sonido", label: "Cabra gritona", desc: "Cabra gritando", icon: Laugh, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.goat.screaming.ambient hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "TNT encendida", desc: "Mecha de TNT a su lado", icon: Bomb, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.tnt.primed hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Cristal roto", desc: "Se rompe una ventana", icon: Box, cmds: ["execute at {t} rotated as {t} run playsound minecraft:block.glass.break hostile {t} ^8 ^ ^-8 1 1"] },
  { tier: "sonido", label: "Ghast avisa", desc: "Ghast a punto de disparar", icon: Flame, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.ghast.warn hostile {t} ^8 ^ ^-8 1 1"] },
  { tier: "sonido", label: "Blaze", desc: "Disparo de blaze", icon: Flame, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.blaze.shoot hostile {t} ^8 ^ ^-8 1 1"] },
  { tier: "sonido", label: "Rugido de ravager", desc: "Ravager rugiendo", icon: Skull, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.ravager.roar hostile {t} ^8 ^ ^-8 1 1"] },
  { tier: "sonido", label: "Enderman mirandote", desc: "Sonido de cuando miras a un enderman", icon: Eye, cmds: ["execute at {t} run playsound minecraft:entity.enderman.stare hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Creaking", desc: "El Creaking se activa detras", icon: Ghost, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.creaking.activate hostile {t} ^ ^ ^-3 1 1","execute at {t} rotated as {t} run playsound minecraft:entity.creaking.ambient hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Breeze", desc: "Breeze cargando viento", icon: Tornado, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.breeze.charge hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Murcielago", desc: "Murcielago en la oreja", icon: Bird, cmds: ["execute at {t} run playsound minecraft:entity.bat.ambient hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Loro creeper", desc: "Loro imitando a un creeper", icon: Bird, cmds: ["execute at {t} rotated as {t} run playsound minecraft:entity.parrot.imitate.creeper hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "sonido", label: "Cuerno de cabra", desc: "Cuerno de guerra lejano", icon: Megaphone, cmds: ["execute at {t} rotated as {t} run playsound minecraft:item.goat_horn.sound.0 hostile {t} ^8 ^ ^-8 1 1"] },
  { tier: "sonido", label: "Muerte del Wither", desc: "El Wither muere (sin Wither)", icon: Skull, cmds: ["execute at {t} run playsound minecraft:entity.wither.death hostile {t} ~ ~ ~ 0.5 1"] },
  { tier: "sonido", label: "Disco 11", desc: "El disco maldito 11", icon: Music, cmds: ["execute at {t} run playsound minecraft:music_disc.11 hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Disco 13", desc: "Ambiente inquietante del disco 13", icon: Music, cmds: ["execute at {t} run playsound minecraft:music_disc.13 hostile {t} ~ ~ ~ 1 1"] },
  { tier: "sonido", label: "Parar musica", desc: "Corta cualquier sonido/disco que este oyendo", icon: Volume2, cmds: ["stopsound {t}"] },
  { tier: "sonido", label: "Combo terror", desc: "Cueva + warden + grito de enderman seguidos", icon: Skull, cmds: ["execute at {t} run playsound minecraft:ambient.cave hostile {t} ~ ~ ~ 1 1","execute at {t} rotated as {t} run playsound minecraft:entity.warden.heartbeat hostile {t} ^ ^ ^-3 1 1","execute at {t} rotated as {t} run playsound minecraft:entity.enderman.scream hostile {t} ^ ^ ^-3 1 1"] },
  // ---- bromas: molestan un rato, sin daño ----
  { tier: "broma", label: "Mareo", desc: "Nauseas 30 s", icon: Frown, cmds: ["effect give {t} minecraft:nausea 30 0 true"] },
  { tier: "broma", label: "Lento", desc: "Lentitud IV 30 s", icon: Snail, cmds: ["effect give {t} minecraft:slowness 30 3 true"] },
  { tier: "broma", label: "Saltito", desc: "Levitacion 4 s con caida lenta (no muere)", icon: ArrowUp, cmds: ["effect give {t} minecraft:levitation 4 1 true", "effect give {t} minecraft:slow_falling 20 0 true"] },
  { tier: "broma", label: "A oscuras", desc: "Ceguera + fatiga de minero 20 s", icon: EyeOff, cmds: ["effect give {t} minecraft:blindness 20 0 true", "effect give {t} minecraft:mining_fatigue 20 4 true"] },
  { tier: "broma", label: "Te vigilan", desc: "Titulo inquietante en pantalla + latido", icon: AlertTriangle, cmds: ["title {t} times 10 60 20", 'title {t} title {"text":"Te estan vigilando...","color":"dark_red","bold":true}', "execute at {t} run playsound minecraft:entity.warden.heartbeat hostile {t} ~ ~ ~ 1 1"] },
  { tier: "broma", label: "Gallinas", desc: "6 gallinas a su alrededor", icon: Bird, cmds: Array.from({ length: 6 }, (_, i) => `execute at {t} run summon minecraft:chicken ~${(i % 3) - 1} ~ ~${Math.floor(i / 3) * 2 - 1}`) },
  { tier: "broma", label: "Quitar todo", desc: "Limpia todos sus efectos (deshace las bromas)", icon: Heart, cmds: ["effect clear {t}"] },

  { tier: "broma", label: "Media vuelta", desc: "Le gira la camara 180°", icon: RotateCcw, cmds: ["execute as {t} at @s run tp @s ~ ~ ~ ~180 ~"] },
  { tier: "broma", label: "Mirar al cielo", desc: "La camara apunta arriba", icon: ArrowUp, cmds: ["execute as {t} at @s run tp @s ~ ~ ~ ~ -90"] },
  { tier: "broma", label: "Mirar al suelo", desc: "La camara apunta abajo", icon: ArrowDownToLine, cmds: ["execute as {t} at @s run tp @s ~ ~ ~ ~ 90"] },
  { tier: "broma", label: "Brillar", desc: "Todos lo ven a traves de las paredes 60 s", icon: Sun, cmds: ["effect give {t} minecraft:glowing 60 0 true"] },
  { tier: "broma", label: "Invisible", desc: "Se vuelve invisible 60 s (se asusta el mismo)", icon: Ghost, cmds: ["effect give {t} minecraft:invisibility 60 0 true"] },
  { tier: "broma", label: "Hiperveloz", desc: "Velocidad X durante 10 s (dificil de controlar)", icon: Rocket, cmds: ["effect give {t} minecraft:speed 10 9 true"] },
  { tier: "broma", label: "Canguro", desc: "Salto V durante 30 s + caida lenta", icon: Rabbit, cmds: ["effect give {t} minecraft:jump_boost 30 4 true","effect give {t} minecraft:slow_falling 35 0 true"] },
  { tier: "broma", label: "Mala suerte", desc: "Mala suerte 5 min (peor botin)", icon: Frown, cmds: ["effect give {t} minecraft:unluck 300 0 true"] },
  { tier: "broma", label: "Telaraña", desc: "Una telaraña en sus pies (solo si hay aire)", icon: Footprints, cmds: ["execute at {t} run setblock ~ ~ ~ minecraft:cobweb keep"] },
  { tier: "broma", label: "Jaula de cristal", desc: "Lo encierra en cristal (lo puede romper; no pisa bloques existentes)", icon: Box, cmds: ["execute at {t} align xyz run fill ~-1 ~ ~-1 ~1 ~1 ~-1 minecraft:glass keep","execute at {t} align xyz run fill ~-1 ~ ~1 ~1 ~1 ~1 minecraft:glass keep","execute at {t} align xyz run fill ~-1 ~ ~ ~-1 ~1 ~ minecraft:glass keep","execute at {t} align xyz run fill ~1 ~ ~ ~1 ~1 ~ minecraft:glass keep","execute at {t} align xyz run fill ~-1 ~2 ~-1 ~1 ~2 ~1 minecraft:glass keep","execute at {t} align xyz run fill ~-1 ~-1 ~-1 ~1 ~-1 ~1 minecraft:glass keep"] },
  { tier: "broma", label: "Calabaza en la cabeza", desc: "Le pone una calabaza con maldicion de ligamiento, SOLO si no lleva casco", icon: Drama, cmds: ["execute unless items entity {t} armor.head * run item replace entity {t} armor.head with minecraft:carved_pumpkin[enchantments={\"minecraft:binding_curse\":1}]"] },
  { tier: "broma", label: "Quitar calabaza", desc: "Le quita la calabaza (solo si es la calabaza)", icon: Drama, cmds: ["execute if items entity {t} armor.head minecraft:carved_pumpkin run item replace entity {t} armor.head with minecraft:air"] },
  { tier: "broma", label: "Montar cerdito", desc: "Invoca un cerdo y lo monta encima", icon: PiggyBank, cmds: ["execute at {t} run summon minecraft:pig ~ ~ ~ {Tags:[\"broma_cerdo\"]}","ride {t} mount @e[type=minecraft:pig,tag=broma_cerdo,limit=1,sort=nearest]","tag @e[type=minecraft:pig,tag=broma_cerdo] remove broma_cerdo"] },
  { tier: "broma", label: "Creeper de mentira", desc: "Un creeper que explota sin hacer daño", icon: Bomb, cmds: ["execute at {t} rotated as {t} run summon minecraft:creeper ^ ^ ^2 {Fuse:30,ignited:1b,ExplosionRadius:0b}"] },
  { tier: "broma", label: "Lluvia de peces", desc: "8 salmones caen y aletean (no hacen daño)", icon: Fish, cmds: ["execute at {t} run summon minecraft:salmon ~-1 ~5 ~-1","execute at {t} run summon minecraft:salmon ~0 ~5 ~-1","execute at {t} run summon minecraft:salmon ~1 ~5 ~-1","execute at {t} run summon minecraft:salmon ~-1 ~5 ~0","execute at {t} run summon minecraft:salmon ~0 ~5 ~0","execute at {t} run summon minecraft:salmon ~1 ~5 ~0","execute at {t} run summon minecraft:salmon ~-1 ~5 ~1","execute at {t} run summon minecraft:salmon ~0 ~5 ~1"] },
  { tier: "broma", label: "Ovejas de colores", desc: "6 ovejas arcoiris (jeb_) a su alrededor", icon: Sparkles, cmds: ["execute at {t} run summon minecraft:sheep ~-1 ~ ~-1 {CustomName:\"jeb_\"}","execute at {t} run summon minecraft:sheep ~0 ~ ~-1 {CustomName:\"jeb_\"}","execute at {t} run summon minecraft:sheep ~1 ~ ~-1 {CustomName:\"jeb_\"}","execute at {t} run summon minecraft:sheep ~-1 ~ ~1 {CustomName:\"jeb_\"}","execute at {t} run summon minecraft:sheep ~0 ~ ~1 {CustomName:\"jeb_\"}","execute at {t} run summon minecraft:sheep ~1 ~ ~1 {CustomName:\"jeb_\"}"] },
  { tier: "broma", label: "Nieve", desc: "Nevada de particulas solo para el", icon: Snowflake, cmds: ["execute at {t} run particle minecraft:snowflake ~ ~1 ~ 3 2 3 0.02 400 force {t}"] },
  { tier: "broma", label: "Enfadado", desc: "Nubes de aldeano enfadado sobre su cabeza (lo ven todos)", icon: Frown, cmds: ["execute at {t} run particle minecraft:angry_villager ~ ~1 ~ 0.4 0.4 0.4 0 20 force"] },
  { tier: "broma", label: "Corazones", desc: "Corazones flotando alrededor (lo ven todos)", icon: Heart, cmds: ["execute at {t} run particle minecraft:heart ~ ~1 ~ 0.6 0.6 0.6 0 20 force"] },
  { tier: "broma", label: "Humo", desc: "Nube de humo a su alrededor", icon: Wind, cmds: ["execute at {t} run particle minecraft:large_smoke ~ ~1 ~ 0.6 0.8 0.6 0.02 80 force"] },
  { tier: "broma", label: "Almas", desc: "Fuego de almas girando (solo el lo ve)", icon: Ghost, cmds: ["execute at {t} run particle minecraft:soul_fire_flame ~ ~1 ~ 1.5 1 1.5 0.02 150 force {t}"] },
  { tier: "broma", label: "Maldicion falsa", desc: "Cara del guardian + sonido, sin efecto", icon: Skull, cmds: ["execute at {t} run particle minecraft:elder_guardian ~ ~ ~ 0 0 0 0 1 force {t}","execute at {t} run playsound minecraft:entity.elder_guardian.curse hostile {t} ~ ~ ~ 1 1"] },
  { tier: "broma", label: "Titulo: te van a banear", desc: "Aviso falso de baneo en pantalla", icon: Ban, cmds: ["title {t} times 10 60 20","title {t} subtitle {\"text\":\"Motivo: ser demasiado malo\",\"color\":\"gray\"}","title {t} title {\"text\":\"Seras baneado en 10 s\",\"color\":\"dark_red\",\"bold\":true}"] },
  { tier: "broma", label: "Titulo: reinicio falso", desc: "Aviso de reinicio falso en pantalla", icon: Hourglass, cmds: ["title {t} times 10 60 20","title {t} subtitle {\"text\":\"Guarda todo YA\",\"color\":\"gray\"}","title {t} title {\"text\":\"Reinicio en 5 s\",\"color\":\"gold\",\"bold\":true}"] },
  { tier: "broma", label: "Titulo: detras de ti", desc: "¡Mira detras de ti! + sonido", icon: Eye, cmds: ["title {t} times 10 60 20","title {t} subtitle {\"text\":\"\",\"color\":\"gray\"}","title {t} title {\"text\":\"MIRA DETRAS DE TI\",\"color\":\"dark_red\",\"bold\":true}","execute at {t} rotated as {t} run playsound minecraft:entity.enderman.scream hostile {t} ^ ^ ^-3 1 1"] },
  { tier: "broma", label: "Expulsar de broma", desc: "Kick con mensaje gracioso (vuelve a entrar sin perder nada)", icon: UserX, cmds: ["kick {t} Tu internet se ha cansado de ti. Vuelve a entrar :)"], confirm: true },
  // ---- cuerpo: tamaño y gravedad ----
  { tier: "cuerpo", label: "Enano", desc: "Mide 30 % (hasta que lo reviertas)", icon: Shrink, cmds: ["attribute {t} minecraft:scale base set 0.3"] },
  { tier: "cuerpo", label: "Mini", desc: "Mide 60 %", icon: Shrink, cmds: ["attribute {t} minecraft:scale base set 0.6"] },
  { tier: "cuerpo", label: "Grande", desc: "Mide 150 %", icon: Expand, cmds: ["attribute {t} minecraft:scale base set 1.5"] },
  { tier: "cuerpo", label: "Gigante", desc: "Mide 250 % (ojo con techos)", icon: Expand, cmds: ["attribute {t} minecraft:scale base set 2.5"] },
  { tier: "cuerpo", label: "Luna", desc: "Gravedad muy baja: salta y flota", icon: Moon, cmds: ["attribute {t} minecraft:gravity base set 0.02","effect give {t} minecraft:slow_falling 10 0 true"] },
  { tier: "cuerpo", label: "Plomo", desc: "Gravedad x3 y casi no salta", icon: ArrowDownToLine, cmds: ["attribute {t} minecraft:gravity base set 0.24","attribute {t} minecraft:jump_strength base set 0.25"] },
  { tier: "cuerpo", label: "Tortuga", desc: "Velocidad de movimiento muy baja", icon: Snail, cmds: ["attribute {t} minecraft:movement_speed base set 0.04"] },
  { tier: "cuerpo", label: "Brazos cortos", desc: "Alcance para romper/poner bloques de 1,5", icon: Hand, cmds: ["attribute {t} minecraft:block_interaction_range base set 1.5"] },
  { tier: "cuerpo", label: "Brazos largos", desc: "Alcance de 10 bloques (premio o broma)", icon: Hand, cmds: ["attribute {t} minecraft:block_interaction_range base set 10"] },
  { tier: "cuerpo", label: "Volver a la normalidad", desc: "Restaura tamaño, gravedad, salto, velocidad y alcance", icon: RotateCcw, cmds: ["attribute {t} minecraft:scale base reset","attribute {t} minecraft:gravity base reset","attribute {t} minecraft:jump_strength base reset","attribute {t} minecraft:movement_speed base reset","attribute {t} minecraft:block_interaction_range base reset"] },
  // ---- chat: mensajes falsos ----
  { tier: "chat", label: "Hacerle decir…", desc: "El jugador 'dice' en el chat lo que escribas en Mensaje", icon: MessageSquare, cmds: ["execute as {t} run say {m}"], needsMsg: true },
  { tier: "chat", label: "Pedir perdon", desc: "Dice en el chat que pide perdon a todos", icon: MessageSquare, cmds: ["execute as {t} run say Perdon a todos, me porte mal y no lo volvere a hacer"] },
  { tier: "chat", label: "Confesion", desc: "Confiesa en el chat que es noob", icon: MessageSquare, cmds: ["execute as {t} run say Confieso que soy el mas noob del servidor"] },
  { tier: "chat", label: "Susurro anonimo", desc: "Le llega un susurro misterioso con tu mensaje", icon: Ghost, cmds: ["tellraw {t} {\"text\":\"??? te susurra: {m}\",\"color\":\"dark_gray\",\"italic\":true}","execute at {t} run playsound minecraft:entity.enderman.ambient hostile {t} ~ ~ ~ 0.6 0.6"], needsMsg: true },
  { tier: "chat", label: "Herobrine", desc: "Herobrine le habla y suena la cueva", icon: Skull, cmds: ["tellraw {t} [{\"text\":\"<Herobrine> \",\"color\":\"white\"},{\"text\":\"Te estoy mirando...\",\"color\":\"gray\"}]","execute at {t} run playsound minecraft:ambient.cave hostile {t} ~ ~ ~ 1 1"] },
  { tier: "chat", label: "OP falso", desc: "Mensaje gris de que lo han hecho operador", icon: ShieldPlus, cmds: ["tellraw {t} {\"text\":\"[Server: Made {t} a server operator]\",\"color\":\"gray\",\"italic\":true}"] },
  { tier: "chat", label: "Muerte falsa", desc: "Todos ven que murio de forma ridicula", icon: Skull, cmds: ["tellraw @a {\"text\":\"{t} se tropezo con una alfombra y murio\"}"] },
  { tier: "chat", label: "Salida falsa", desc: "Todos ven que salio del servidor", icon: UserX, cmds: ["tellraw @a {\"text\":\"[-] {t} salio del servidor\",\"color\":\"yellow\"}"] },
  { tier: "chat", label: "Logro falso", desc: "Todos ven un logro humillante + sonido de logro para el", icon: Trophy, cmds: ["tellraw @a [{\"text\":\"{t} ha conseguido el logro \"},{\"text\":\"[Profesional del lag]\",\"color\":\"green\"}]","execute at {t} run playsound minecraft:ui.toast.challenge_complete hostile {t} ~ ~ ~ 1 1"] },
  { tier: "chat", label: "Subida de nivel falsa", desc: "Suena como si subiera de nivel", icon: Star, cmds: ["execute at {t} run playsound minecraft:entity.player.levelup hostile {t} ~ ~ ~ 1 1"] },
  { tier: "chat", label: "Aviso de moderacion", desc: "Mensaje rojo de que esta siendo vigilado", icon: AlertTriangle, cmds: ["tellraw {t} {\"text\":\"[Moderacion] Tu cuenta esta siendo revisada por actividad sospechosa.\",\"color\":\"red\"}"] },
];

// Premios moderados: nada que rompa la progresion de un survival
const REWARD: Action[] = [
  // ---- pequeños: reconocimiento y detalles ----
  { tier: "pequeno", label: "Felicitar", desc: "Titulo dorado + mensaje privado + fuegos artificiales", icon: PartyPopper, needsMsg: true, cmds: [...title("{t}", "¡FELICIDADES!", "gold", "{m}"), tell("{t}", "{m}", "gold"), "execute at {t} run summon minecraft:firework_rocket ~ ~1 ~ {LifeTime:20,FireworkItem:{id:\"minecraft:firework_rocket\",count:1,components:{\"minecraft:fireworks\":{explosions:[{shape:\"large_ball\",colors:[I;16766720,16711680,65280],has_trail:true}],flight_duration:1}}}}"] },
  { tier: "pequeno", label: "Anunciar a todos", desc: "Anuncio publico: \"★ {jugador} ...\"", icon: Megaphone, needsMsg: true, cmds: [`tellraw @a [{"text":"★ ","color":"gold"},{"text":"{t}","color":"yellow","bold":true},{"text":" {m}","color":"gold"}]`] },
  { tier: "pequeno", label: "MVP del dia", desc: "Titulo para TODOS: '{jugador} es el MVP de hoy' + fuegos", icon: Crown, cmds: [`title @a times 10 80 20`, `title @a subtitle {"text":"{t}","color":"yellow","bold":true}`, `title @a title {"text":"MVP DE HOY","color":"gold","bold":true}`, "execute at {t} run summon minecraft:firework_rocket ~ ~1 ~ {LifeTime:25}", "execute at {t} run summon minecraft:firework_rocket ~2 ~1 ~ {LifeTime:30}", "execute at {t} run summon minecraft:firework_rocket ~-2 ~1 ~ {LifeTime:35}"] },
  { tier: "pequeno", label: "Curar", desc: "Vida y comida al maximo, sin efectos malos", icon: Heart, cmds: ["effect clear {t}", "effect give {t} minecraft:instant_health 1 10 true", "effect give {t} minecraft:saturation 1 10 true"] },
  { tier: "pequeno", label: "+5 niveles", desc: "Experiencia", icon: Sparkles, cmds: ["xp add {t} 5 levels"] },
  { tier: "pequeno", label: "Comida", desc: "16 filetes cocinados + 8 panes", icon: Beef, cmds: ["give {t} minecraft:cooked_beef 16", "give {t} minecraft:bread 8"] },
  { tier: "pequeno", label: "Frascos de XP", desc: "8 frascos de experiencia", icon: Sparkles, cmds: ["give {t} minecraft:experience_bottle 8"] },
  { tier: "pequeno", label: "Flechas y antorchas", desc: "32 flechas + 32 antorchas", icon: Sun, cmds: ["give {t} minecraft:arrow 32", "give {t} minecraft:torch 32"] },
  { tier: "pequeno", label: "Aplausos", desc: "Sonido de logro + totem + corazones", icon: PartyPopper, cmds: ["execute at {t} run playsound minecraft:ui.toast.challenge_complete hostile {t} ~ ~ ~ 1 1","execute at {t} run particle minecraft:totem_of_undying ~ ~1 ~ 0.6 1 0.6 0.4 80 force {t}","execute at {t} run particle minecraft:heart ~ ~1 ~ 0.6 0.6 0.6 0 15 force"] },
  { tier: "pequeno", label: "Vision nocturna", desc: "10 min", icon: Eye, cmds: ["effect give {t} minecraft:night_vision 600 0 true"] },
  { tier: "pequeno", label: "Respirar bajo el agua", desc: "5 min + gracia de delfin", icon: Waves, cmds: ["effect give {t} minecraft:water_breathing 300 0 true","effect give {t} minecraft:dolphins_grace 120 0 true"] },
  { tier: "pequeno", label: "Resistencia al fuego", desc: "5 min", icon: Flame, cmds: ["effect give {t} minecraft:fire_resistance 300 0 true"] },
  { tier: "pequeno", label: "Saltarin", desc: "Salto II 2 min", icon: Rabbit, cmds: ["effect give {t} minecraft:jump_boost 120 1 true"] },
  { tier: "pequeno", label: "Galletas y pastel", desc: "16 galletas + 1 pastel", icon: Cake, cmds: ["give {t} minecraft:cookie 16","give {t} minecraft:cake 1"] },
  { tier: "pequeno", label: "Su propia cabeza", desc: "Cabeza de jugador con su skin", icon: Crown, cmds: ["give {t} minecraft:player_head[profile=\"{t}\"] 1"] },
  { tier: "pequeno", label: "Etiqueta de nombre", desc: "1 etiqueta para bautizar a su mascota", icon: Tag, cmds: ["give {t} minecraft:name_tag 1"] },
  { tier: "pequeno", label: "Fuegos para todos", desc: "Fuegos artificiales en su posicion", icon: Rocket, cmds: ["execute at {t} run summon minecraft:firework_rocket ~ ~12 ~ {LifeTime:10,FireworkItem:{id:\"minecraft:firework_rocket\",count:1,components:{\"minecraft:fireworks\":{explosions:[{shape:\"star\",colors:[I;16776960,65535],has_twinkle:true}],flight_duration:1}}}}","execute at {t} run summon minecraft:firework_rocket ~3 ~14 ~ {LifeTime:15,FireworkItem:{id:\"minecraft:firework_rocket\",count:1,components:{\"minecraft:fireworks\":{explosions:[{shape:\"large_ball\",colors:[I;16711935],has_trail:true}],flight_duration:1}}}}"] },
  // ---- especiales: valen algo, pero se consiguen jugando en poco tiempo ----
  { tier: "especial", label: "3 diamantes", desc: "give diamond 3", icon: Gem, cmds: ["give {t} minecraft:diamond 3"] },
  { tier: "especial", label: "Lote de hierro", desc: "16 lingotes de hierro + 8 de oro", icon: Pickaxe, cmds: ["give {t} minecraft:iron_ingot 16", "give {t} minecraft:gold_ingot 8"] },
  { tier: "especial", label: "16 esmeraldas", desc: "Para comerciar con aldeanos", icon: Coins, cmds: ["give {t} minecraft:emerald 16"] },
  { tier: "especial", label: "Manzana dorada", desc: "1 manzana dorada (normal)", icon: Apple, cmds: ["give {t} minecraft:golden_apple 1"] },
  { tier: "especial", label: "Pico de hierro encantado", desc: "Eficiencia II + Irrompibilidad I", icon: Pickaxe, cmds: ["give {t} minecraft:iron_pickaxe[enchantments={\"minecraft:efficiency\":2,\"minecraft:unbreaking\":1}] 1"] },
  { tier: "especial", label: "Libro: Irrompibilidad I", desc: "Libro encantado modesto", icon: ScrollText, cmds: ["give {t} minecraft:enchanted_book[stored_enchantments={\"minecraft:unbreaking\":1}] 1"] },
  { tier: "especial", label: "Caballo con silla", desc: "Invoca un caballo domesticado a su lado + una silla", icon: Wind, cmds: ["execute at {t} run summon minecraft:horse ~1 ~ ~1 {Tame:1b,Health:30f}", "give {t} minecraft:saddle 1"] },
  { tier: "especial", label: "Buff de trabajo (5 min)", desc: "Prisa I + Velocidad I durante 5 min", icon: Zap, cmds: ["effect give {t} minecraft:haste 300 0 true", "effect give {t} minecraft:speed 300 0 true"] },
  { tier: "especial", label: "Suerte (10 min)", desc: "Mejor botin al pescar y en cofres", icon: Zap, cmds: ["effect give {t} minecraft:luck 600 0 true"] },
  // ---- administracion ----
  { tier: "especial", label: "Perlas de ender", desc: "4 perlas", icon: Sparkles, cmds: ["give {t} minecraft:ender_pearl 4"] },
  { tier: "especial", label: "Cohetes", desc: "16 cohetes (para elitros)", icon: Rocket, cmds: ["give {t} minecraft:firework_rocket 16"] },
  { tier: "especial", label: "Frascos de XP x16", desc: "16 frascos de experiencia", icon: Sparkles, cmds: ["give {t} minecraft:experience_bottle 16"] },
  { tier: "especial", label: "Gigante por un rato", desc: "Mide 200 % (revertir con 'Volver a la normalidad')", icon: Expand, cmds: ["attribute {t} minecraft:scale base set 2"] },
  { tier: "especial", label: "Gravedad lunar", desc: "Salta y cae como en la luna (revertir con 'Volver a la normalidad')", icon: Moon, cmds: ["attribute {t} minecraft:gravity base set 0.03"] },
  { tier: "especial", label: "Brazos largos", desc: "Alcance de 8 bloques (revertir con 'Volver a la normalidad')", icon: Hand, cmds: ["attribute {t} minecraft:block_interaction_range base set 8"] },
  { tier: "especial", label: "Buff de explorador", desc: "Velocidad II + vision nocturna + caida lenta 5 min", icon: Wind, cmds: ["effect give {t} minecraft:speed 300 1 true","effect give {t} minecraft:night_vision 300 0 true","effect give {t} minecraft:slow_falling 300 0 true"] },
  { tier: "especial", label: "Dar OP", desc: "Permisos de operador", icon: ShieldPlus, confirm: true, cmds: ["op {t}"] },
  { tier: "especial", label: "Volver a supervivencia", desc: "Quita espectador/aventura (revierte castigos)", icon: Anchor, cmds: ["gamemode survival {t}"] },
];

const TIERS: Record<Tier, { label: string; desc: string }> = {
  leve: { label: "Leves", desc: "Molestan sin hacer daño real" },
  medio: { label: "Medios", desc: "Castigan de verdad, pero se revierten solos o con un clic" },
  grave: { label: "Graves", desc: "Irreversibles o de acceso: piden confirmacion" },
  pequeno: { label: "Pequeños", desc: "Reconocimiento y detalles que no alteran el juego" },
  especial: { label: "Especiales", desc: "Valen algo, pero nada que no se consiga jugando un rato" },
  sonido: { label: "Sonidos", desc: "Solo los oye el jugador elegido; sin mobs ni daño" },
  broma: { label: "Molestias", desc: "Efectos cortos, sin daño ni perdida de objetos" },
  cuerpo: { label: "Cuerpo", desc: "Tamaño, gravedad y alcance; se revierten con 'Volver a la normalidad'" },
  chat: { label: "Chat", desc: "Mensajes falsos: no pasa nada de verdad" },
};

function Group({ list, tier, target, msg, tone }: { list: Action[]; tier: Tier; target: string; msg: string; tone: "bad" | "good" | "fun" }) {
  const items = list.filter((a) => a.tier === tier);
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2"><span className={cn("text-xs font-semibold uppercase tracking-wider", tone === "bad" ? "text-destructive" : tone === "fun" ? "text-chart-4" : "text-primary")}>{TIERS[tier].label}</span><span className="text-[11px] text-muted-foreground">{TIERS[tier].desc}</span></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{items.map((a) => <ActionButton key={a.label} a={a} target={target} msg={msg} tone={tone} />)}</div>
    </div>
  );
}

function ActionButton({ a, target, msg, tone }: { a: Action; target: string; msg: string; tone: "bad" | "good" | "fun" }) {
  const { run, online, running } = useCommands();
  const perms = usePermissions();
  const resolved = a.cmds.map((c) => c.replaceAll("{t}", target.trim() || "x").replaceAll("{m}", msg.trim() || "x"));
  const adminOnly = !perms.can("command.dangerous") && resolved.some(isDangerousCommand);
  const ready = !!target.trim() && (!a.needsMsg || !!msg.trim()) && !adminOnly;
  const exec = async () => {
    for (const c of a.cmds) { const ok = await run(c.replaceAll("{t}", target.trim()).replaceAll("{m}", msg.trim())); if (!ok) break; }
  };
  const btn = (
    <button disabled={!online || running || !ready} onClick={a.confirm ? undefined : exec}
      className={cn("group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        tone === "bad" ? "hover:border-destructive/50 hover:bg-destructive/10" : tone === "fun" ? "hover:border-chart-4/50 hover:bg-chart-4/10" : "hover:border-primary/50 hover:bg-primary/10",
        a.danger && "border-destructive/30")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", tone === "bad" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}><a.icon className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium">{a.label}{a.needsMsg && <Badge variant="outline" className="h-4 px-1 text-[9px]">motivo</Badge>}{a.confirm && <Badge variant="outline" className="h-4 border-destructive/40 px-1 text-[9px] text-destructive">confirmar</Badge>}{adminOnly && <AdminBadge />}</span>
        <span className="block text-xs text-muted-foreground">{a.desc}</span>
      </span>
    </button>
  );
  if (!a.confirm) return btn;
  return (
    <AlertDialog>
      <AlertDialogTrigger render={btn} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{a.label} a {target}?</AlertDialogTitle>
          <AlertDialogDescription>{a.desc}{msg && <><br />Motivo: <i>{msg}</i></>}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant={tone === "bad" ? "destructive" : "default"} onClick={exec}>Si, {a.label.toLowerCase()}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Board() {
  const { data: server } = useServer(5000);
  const players = server?.players.list ?? [];
  const [target, setTarget] = useState(players[0] ?? "");
  const [msg, setMsg] = useState("");
  const online = server?.status === 1;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Castigos y premios" description="Acciones rapidas sobre un jugador: penitencias para quien se porta mal y recompensas para quien se lo gana.">
        <StatusBadge status={server?.status} />
      </PageHeader>

      <Card>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Jugador objetivo</p>
            <TargetPicker value={target} onChange={setTarget} players={players} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Motivo / mensaje (para las acciones marcadas)</p>
            <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Ej. por griefear la base de Juan / por ganar el evento" />
            <p className="mt-1 text-[11px] text-muted-foreground">Se muestra al jugador en pantalla y en el chat.</p>
          </div>
        </CardContent>
      </Card>

      {!online && <div className="rounded-lg border border-chart-3/30 bg-chart-3/10 px-3 py-2 text-sm text-chart-3">El servidor no esta en linea.</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><Gavel className="size-4" />Castigos</CardTitle>
            <CardDescription>De menor a mayor. Los marcados con &quot;confirmar&quot; piden confirmacion; los graves son irreversibles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(["leve", "medio", "grave"] as Tier[]).map((t) => <Group key={t} list={PUNISH} tier={t} target={target} msg={msg} tone="bad" />)}
          </CardContent>
        </Card>
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary"><Trophy className="size-4" />Premios</CardTitle>
            <CardDescription>Recompensas moderadas: reconocimiento, comida, algo de recursos y buffs cortos. Nada que rompa el survival.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(["pequeno", "especial"] as Tier[]).map((t) => <Group key={t} list={REWARD} tier={t} target={target} msg={msg} tone="good" />)}
          </CardContent>
        </Card>
      </div>

      <Card className="border-chart-4/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-chart-4"><Drama className="size-4" />Bromas</CardTitle>
          <CardDescription>Para divertirse entre amigos: sustos con sonido y molestias cortas. Nadie pierde vida ni objetos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          {(["sonido", "broma", "cuerpo", "chat"] as Tier[]).map((t) => <Group key={t} list={PRANKS} tier={t} target={target} msg={msg} tone="fun" />)}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DisciplinePage() {
  const { data: server } = useServer(5000);
  return <CommandProvider online={server?.status === 1}><Board /></CommandProvider>;
}
