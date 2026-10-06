export type RoomId = "sala_1" | "sala_2" | "sala_3" | "auditorio";
export type RoomTipo = "individual" | "auditorio";
export type Modality = "presencial" | "online";
export type Category = "atendimento" | "reuniao" | "evento";

export interface Room {
  id: RoomId;
  nome: string;
  cor: string;
  badge: string;
  tipo: RoomTipo;
}

export const ROOMS: Room[] = [
  { id: "sala_1",    nome: "Sala 1 · Harmonia",                          cor: "#059669", badge: "bg-emerald-100 text-emerald-800 border-emerald-200", tipo: "individual" },
  { id: "sala_2",    nome: "Sala 2 · Serenidade",                        cor: "#0d9488", badge: "bg-teal-100 text-teal-800 border-teal-200",       tipo: "individual" },
  { id: "sala_3",    nome: "Sala 3 · Vitalidade",                        cor: "#d97706", badge: "bg-amber-100 text-amber-800 border-amber-200",     tipo: "individual" },
  { id: "auditorio", nome: "Auditório Conexão & Expansão (Salas 1+2+3)", cor: "#4f46e5", badge: "bg-indigo-100 text-indigo-800 border-indigo-200", tipo: "auditorio"  },
];

export const ONLINE_ROOM_LABEL = "Online (Google Meet)";

export function getRoom(id: string | null | undefined): Room | undefined {
  return ROOMS.find((r) => r.id === id);
}

export const CATEGORY_LABEL: Record<Category, string> = {
  atendimento: "Atendimento",
  reuniao: "Reunião",
  evento: "Evento",
};

export const CATEGORY_COLOR: Record<Category, string> = {
  atendimento: "bg-emerald-500",
  reuniao: "bg-sky-500",
  evento: "bg-amber-500",
};
