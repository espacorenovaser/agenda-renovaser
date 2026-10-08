"use client";

import { useEffect, useState } from "react";
import { ROOMS, getRoom, ONLINE_ROOM_LABEL, EXTERNO_ROOM_LABEL } from "@/lib/rooms";
import { formatWhatsAppLink } from "@/lib/whatsapp";
import type { Session } from "@/lib/auth";

type Appointment = {
  id: string;
  title: string;
  patient_name: string | null;
  patient_whatsapp: string | null;
  client_email: string | null;
  patient_email?: string | null;
  room_id: string | null;
  modality: "presencial" | "online" | "externo";
  category: string;
  professional_email: string;
  therapist_email?: string;
  start_at: string;
  end_at: string;
};
type Presenca = { id: string; professional_email: string; date: string; start_at: string; end_at: string; observacao: string | null };

function todaySP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function safeDateStr(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? "")) return todaySP();
  const t = new Date(`${d}T12:00:00-03:00`).getTime();
  return Number.isNaN(t) ? todaySP() : d;
}
function fmtDateBR(d: string): string {
  const [y, m, day] = safeDateStr(d).split("-");
  return `${day}/${m}/${y}`;
}
function toISO(date: string, time: string): string {
  return new Date(`${safeDateStr(date)}T${time}:00-03:00`).toISOString();
}
function fmtTime(d: string): string {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "--:--";
  return t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
function fmtTimeOnly(t: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(t ?? "");
  return m ? `${m[1]}:${m[2]}` : (t ?? "").slice(0, 5);
}
function isValidEmail(v: string): boolean {
  const s = (v ?? "").trim();
  if (s.length < 6 || s.length > 120) return false;
  if (/\s/.test(s) || s.includes("..")) return false;
  if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(s)) return false;
  const [local, domain] = s.split("@");
  if (!local || !domain || !domain.includes(".")) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (domain.startsWith(".") || domain.startsWith("-") || domain.endsWith(".")) return false;
  return true;
}
function phoneDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}
function isValidPhone(v: string): boolean {
  const d = phoneDigits(v);
  if (d.length < 10 || d.length > 13) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const ddd = d.length > 11 ? d.slice(2, 4) : d.slice(0, 2);
  if (ddd.startsWith("0")) return false;
  return true;
}
// Sem sala: externo é no local do cliente, o resto é online.
function placeLabel(a: Appointment): string {
  if (a.room_id) return getRoom(a.room_id)?.nome ?? a.room_id;
  return a.modality === "externo" ? EXTERNO_ROOM_LABEL : ONLINE_ROOM_LABEL;
}
function placeColor(a: Appointment): string {
  if (a.room_id) return getRoom(a.room_id)?.cor ?? "#94a3b8";
  return a.modality === "externo" ? "#a855f7" : "#0ea5e9";
}
function profName(email: string, session: Session, professionals?: { email: string; name: string | null }[]): string {
  if (professionals) {
    const found = professionals.find((p) => p.email.toLowerCase() === email.toLowerCase());
    if (found?.name) return found.name;
  }
  if (email === "claudirisrael@gmail.com") return "Claudir";
  if (email === "clecimarchioro@gmail.com") return "Cleci";
  if (email === "mmgorete00@gmail.com") return "Gorete";
  if (email === "espacorenovaser@gmail.com") return "RenovaSer";
  return email.split("@")[0] ?? email;
}

export default function AgendaClient({ initialView, initialDate, session }: { initialView: string; initialDate: string; session: Session }) {
  const [view, setView] = useState(initialView);
  const [date, setDate] = useState(safeDateStr(initialDate));
  const [items, setItems] = useState<Appointment[]>([]);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [filterRoom, setFilterRoom] = useState<string | null>(null);
  const [showPresenca, setShowPresenca] = useState(false);

  const [fTitle, setFTitle] = useState("");
  const [fDate, setFDate] = useState(safeDateStr(initialDate));
  const [fCliente, setFCliente] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fClientEmail, setFClientEmail] = useState("");
  const [fModality, setFModality] = useState<"presencial" | "online" | "externo">("presencial");
  const [fPhoneError, setFPhoneError] = useState("");
  const [fEmailError, setFEmailError] = useState("");
  const isExternal = fModality === "externo";
  const contactLabel = isExternal ? "Responsável pelo Evento" : "Cliente";
  const contactBlockTitle = isExternal ? "Responsável pelo evento" : "Dados do cliente";
  const contactEmailLabel = isExternal ? "E-mail do responsável" : "E-mail do cliente";
  const [fRoom, setFRoom] = useState("sala_1");
  const [fCategory, setFCategory] = useState("atendimento");
  const [fStart, setFStart] = useState("09:00");
  const [fEnd, setFEnd] = useState("10:00");
  const [fProf, setFProf] = useState(session.email);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [professionals, setProfessionals] = useState<{ email: string; name: string | null; role: string }[]>([]);

  const [pDate, setPDate] = useState(safeDateStr(initialDate));
  const [pStart, setPStart] = useState("08:00");
  const [pEnd, setPEnd] = useState("12:00");
  const [pProf, setPProf] = useState(session.email);
  const [pObs, setPObs] = useState("");

  function dayRange(d: string) {
    const s = safeDateStr(d);
    return {
      start: new Date(`${s}T00:00:00-03:00`).toISOString(),
      end: new Date(`${s}T23:59:59-03:00`).toISOString(),
    };
  }
  function weekRange(d: string) {
    const dt = new Date(`${safeDateStr(d)}T12:00:00-03:00`);
    const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return {
      from: new Date(`${mon.toISOString().slice(0,10)}T00:00:00-03:00`).toISOString(),
      to: new Date(`${sun.toISOString().slice(0,10)}T23:59:59-03:00`).toISOString(),
      mon: mon.toISOString().slice(0,10),
    };
  }

  async function load() {
    setLoading(true);
    let url = "/api/appointments";
    let presUrl = `/api/presencas?date=${date}`;
    if (view === "dia") {
      const r = dayRange(date);
      url += `?from=${encodeURIComponent(r.start)}&to=${encodeURIComponent(r.end)}`;
    } else {
      const r = weekRange(date);
      url += `?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`;
      // semana: busca todas as presenças da semana
      presUrl = `/api/presencas`;
    }
    const [aRes, pRes] = await Promise.all([fetch(url), fetch(presUrl)]);
    const data = await aRes.json();
    const pData = await pRes.json();
    setItems(Array.isArray(data) ? data : []);
    // filtra presenças do dia quando em visão dia
    const pList: Presenca[] = Array.isArray(pData) ? pData : [];
    setPresencas(view === "dia" ? pList.filter(p=>p.date===date) : pList);
    setLoading(false);
  }

  useEffect(() => { load(); }, [date, view]);

  useEffect(() => {
    fetch("/api/professionals")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (Array.isArray(d)) setProfessionals(d); })
      .catch(() => {});
  }, []);

  function openNew(slot?: { date: string; time: string; room?: string }) {
    setEditing(null);
    setFTitle(""); setFCliente(""); setFPhone(""); setFPhoneError(""); setFClientEmail(""); setFEmailError(""); setFCategory("atendimento");
    setFModality("presencial"); setFRoom(slot?.room ?? "sala_1");
    setFStart(slot?.time ?? "09:00");
    const h = parseInt((slot?.time ?? "09:00").split(":")[0] ?? "9", 10);
    setFEnd(String(h + 1).padStart(2,"0")+":00");
    const d = safeDateStr(slot?.date ?? date);
    setDate(d);
    setFDate(d);
    setFProf(session.email);
    setFormError("");
    setShowModal(true);
  }
  function openEdit(a: Appointment) {
    setEditing(a);
    setFTitle(a.title); setFCliente(a.patient_name ?? ""); setFPhone((a.patient_whatsapp ?? "").replace(/\D/g, "").slice(0, 13)); setFPhoneError("");
    setFClientEmail((a.client_email ?? a.patient_email ?? "").slice(0, 120)); setFEmailError("");
    setFCategory(a.category); setFModality(a.modality); setFRoom(a.room_id ?? "sala_1");
    setFStart(fmtTime(a.start_at)); setFEnd(fmtTime(a.end_at));
    const d = safeDateStr(new Date(a.start_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
    setFDate(d);
    setFProf(a.professional_email ?? a.therapist_email ?? session.email);
    setFormError("");
    setShowModal(true);
  }

  function handlePhoneChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 13);
    setFPhone(digits);
    if (!digits) { setFPhoneError(""); return; }
    setFPhoneError(isValidPhone(digits) ? "" : "Use só números com DDD (10 a 13 dígitos, ex: 47999998888).");
  }
  function handleEmailChange(v: string) {
    const clean = v.slice(0, 120);
    setFClientEmail(clean);
    const t = clean.trim();
    if (!t) { setFEmailError(""); return; }
    setFEmailError(isValidEmail(t) ? "" : "Confira o e-mail (ex: nome@email.com).");
  }

  async function submit() {
    setFormError("");
    if (!fTitle.trim()) { setFormError("Informe o título"); return; }
    const dateStr = safeDateStr(fDate);
    const emailTrim = fClientEmail.trim();
    if (emailTrim && !isValidEmail(emailTrim)) { setFormError("Confira o e-mail: parece incompleto (ex: nome@email.com)."); setFEmailError("Confira o e-mail (ex: nome@email.com)."); return; }
    const phoneTrim = fPhone.trim();
    if (phoneTrim && !isValidPhone(phoneTrim)) { setFormError("Confira o WhatsApp: use só números com DDD (ex: 47999998888)."); setFPhoneError("Use só números com DDD (10 a 13 dígitos, ex: 47999998888)."); return; }
    const start_at = toISO(dateStr, fStart);
    const end_at = toISO(dateStr, fEnd);
    if (new Date(end_at) <= new Date(start_at)) { setFormError("Horário final deve ser após o inicial"); return; }
    setSaving(true);
    const isReuniaoEquipe = fCategory === "reuniao" && fTitle.toLowerCase().includes("equipe");
    const participants = isReuniaoEquipe ? ["claudirisrael@gmail.com","clecimarchioro@gmail.com","mmgorete00@gmail.com"] : [];
    const payload: any = {
      title: fTitle.trim(),
      patient_name: fCliente.trim() || null,
      patient_whatsapp: fPhone.replace(/\D/g,"") || null,
      client_email: fClientEmail.trim() || null,
      room_id: fModality === "presencial" ? fRoom : null,
      modality: fModality,
      category: fCategory,
      professional_email: fProf,
      start_at, end_at,
      participants,
    };
    const url = editing ? `/api/appointments/${editing.id}` : "/api/appointments";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload)});
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setFormError(data.error ?? "Erro ao salvar"); return; }
    setShowModal(false);
    setDate(dateStr);
    setFDate(dateStr);
    load();
  }

  async function submitPresenca() {
    const res = await fetch("/api/presencas", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ date: safeDateStr(pDate), start_at: pStart, end_at: pEnd, professional_email: pProf, observacao: pObs || null }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error ?? "Erro ao salvar expediente"); return; }
    setShowPresenca(false);
    load();
  }

  function canManage(a: Appointment): boolean {
    if (session.isAdmin) return true;
    const o = (a.professional_email ?? a.therapist_email ?? "").trim().toLowerCase();
    return !!o && o === session.email.trim().toLowerCase();
  }
  function canManagePresenca(p: Presenca): boolean {
    if (session.isAdmin) return true;
    return !!p.professional_email && p.professional_email.trim().toLowerCase() === session.email.trim().toLowerCase();
  }

  async function del(id: string) {
    if (!confirm("Excluir este agendamento?")) return;
    const res = await fetch(`/api/appointments/${id}`, { method:"DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as any));
      alert(data.error ?? "Sem permissão para excluir este agendamento.");
      return;
    }
    load();
  }

  const hours = Array.from({length:14},(_,i)=> String(8+i).padStart(2,"0")+":00");
  function hourFloor(iso: string): string {
    const t = fmtTime(iso).split(":")[0] ?? "08";
    return `${t.padStart(2,"0")}:00`;
  }
  function hoursCovered(a: Appointment): string[] {
    const startH = parseInt(fmtTime(a.start_at).split(":")[0] ?? "8", 10);
    const endH = parseInt(fmtTime(a.end_at).split(":")[0] ?? "8", 10);
    const endM = parseInt(fmtTime(a.end_at).split(":")[1] ?? "0", 10);
    const last = endM > 0 ? endH : endH - 1;
    const out: string[] = [];
    for (let h = startH; h <= last; h++) out.push(String(h).padStart(2,"0")+":00");
    return out;
  }
  // Bloqueio cruzado: sala individual é bloqueada pela mesma sala + auditório;
  // auditório é bloqueado por qualquer presencial (salas 1/2/3 ou ele mesmo).
  function blockingFor(roomId: string) {
    const list = roomId === "auditorio"
      ? items.filter(a=> a.modality==="presencial" && !!a.room_id)
      : items.filter(a=> a.modality==="presencial" && (a.room_id===roomId || a.room_id==="auditorio"));
    return list.sort((x, y) => new Date(x.start_at).getTime() - new Date(y.start_at).getTime());
  }
  const occupancy = ROOMS.map(r=> {
    const list = blockingFor(r.id);
    const last = list.reduce<Appointment | null>((m, a) => (!m || new Date(a.end_at) > new Date(m.end_at) ? a : m), null);
    return { room: r, count: list.length, list, freeFrom: last ? fmtTime(last.end_at) : null };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={date} onChange={e=>setDate(safeDateStr(e.target.value))} className="border rounded-lg px-3 py-2 text-sm" />
        <button onClick={()=>setDate(todaySP())} className="text-sm border px-3 py-2 rounded-lg">Hoje</button>
        <div className="flex rounded-lg overflow-hidden border text-sm">
          <button onClick={()=>setView("dia")} className={`px-4 py-2 ${view==="dia"?"bg-gray-900 text-white":"bg-white"}`}>Dia</button>
          <button onClick={()=>setView("semana")} className={`px-4 py-2 ${view==="semana"?"bg-gray-900 text-white":"bg-white"}`}>Semana</button>
        </div>
        <button onClick={()=>setShowPresenca(true)} className="text-sm border px-3 py-2 rounded-lg bg-white">+ Expediente</button>
        <button onClick={()=>openNew()} className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg">+ Novo agendamento</button>
      </div>

      {/* Quem está presencial hoje */}
      {presencas.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Quem está no instituto — {new Date(`${safeDateStr(date)}T12:00:00-03:00`).toLocaleDateString("pt-BR")}</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {presencas.map(p=> (
              <span key={p.id} className="inline-flex items-center gap-2 text-sm border border-emerald-200 rounded-full px-3 py-1 bg-emerald-100/60 text-emerald-900">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                {profName(p.professional_email, session, professionals)} {fmtTimeOnly(p.start_at)}–{fmtTimeOnly(p.end_at)}
                {p.observacao && <span className="text-xs text-emerald-700">· {p.observacao}</span>}
                {canManagePresenca(p) && (
                  <button onClick={async()=>{ if(confirm("Remover expediente?")){ const res = await fetch(`/api/presencas?id=${p.id}`,{method:"DELETE"}); if (!res.ok) { const d = await res.json().catch(() => ({} as any)); alert(d.error ?? "Sem permissão para remover este expediente."); return; } load(); } }} className="ml-1 text-emerald-500 hover:text-red-600">×</button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {ROOMS.map(r=> {
          const occ = occupancy.find(o=>o.room.id===r.id)!;
          const isActive = filterRoom===r.id;
          return (
            <button key={r.id} onClick={()=>setFilterRoom(isActive?null:r.id)} className={`text-left border rounded-xl p-3 ${isActive?"ring-2 ring-gray-900":""}`} style={{borderColor: r.cor}} title={isActive ? "Limpar filtro" : "Filtrar por esta sala"}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{background:r.cor}} />
                <span className="text-sm font-medium">{r.nome}</span>
              </div>
              {(() => {
                const own = occ.list.filter(a=> a.room_id===r.id);
                if (r.id!=="auditorio") {
                  // Salas 1/2/3: só os próprios agendamentos, sem "livre a partir"
                  // (o livre a partir mente quando há buracos entre horários)
                  if (own.length===0) {
                    return occ.count>0
                      ? <div className="text-xs font-medium text-amber-700 mt-1">Ocupado (Auditório reservado)</div>
                      : <div className="text-xs text-gray-500 mt-1">Livre hoje</div>;
                  }
                  return (
                    <div className="mt-1 space-y-0.5">
                      {own.slice(0,3).map(a=> (
                        <div key={a.id} className="text-xs text-gray-700 truncate" title={a.title}>
                          {fmtTime(a.start_at)}–{fmtTime(a.end_at)} · {canManage(a) ? profName(a.professional_email ?? a.therapist_email ?? "", session, professionals) : "Reservado"}
                        </div>
                      ))}
                      {own.length>3 && <div className="text-[11px] text-gray-400">+{own.length-3} agendamento(s)</div>}
                    </div>
                  );
                }
                // Auditório: detalhe só do que é dele; bloqueio vindo de sala mostra só o livre a partir
                if (own.length===0) {
                  if (occ.count===0) return <div className="text-xs text-gray-500 mt-1">Livre hoje</div>;
                  return <div className="text-xs font-medium text-amber-700 mt-1">Ocupado — livre a partir das {occ.freeFrom}</div>;
                }
                return (
                  <div className="mt-1 space-y-0.5">
                    {own.slice(0,3).map(a=> (
                      <div key={a.id} className="text-xs text-gray-700 truncate" title={a.title}>
                        {fmtTime(a.start_at)}–{fmtTime(a.end_at)} · {canManage(a) ? profName(a.professional_email ?? a.therapist_email ?? "", session, professionals) : "Reservado"}
                      </div>
                    ))}
                    {own.length>3 && <div className="text-[11px] text-gray-400">+{own.length-3} agendamento(s)</div>}
                    {occ.freeFrom && <div className="text-[11px] font-medium text-emerald-700">Livre a partir das {occ.freeFrom}</div>}
                  </div>
                );
              })()}
            </button>
          );
        })}
      </div>

      {loading ? <div className="text-sm text-gray-500">Carregando…</div> : null}

      {view==="dia" && (
        <div className="bg-white border rounded-xl overflow-hidden">
          {hours.map(h=> {
            const startingHere = items.filter(a=> hourFloor(a.start_at) === h);
            const continuingHere = items.filter(a=> {
              const covered = hoursCovered(a);
              return covered.includes(h) && hourFloor(a.start_at) !== h;
            });
            const allHere = [...startingHere, ...continuingHere];
            return (
              <div key={h} className="flex border-b last:border-0 min-h-[56px]">
                <div className="w-20 shrink-0 border-r bg-gray-50 text-xs text-gray-500 flex items-start justify-center pt-2">{h}</div>
                <div className="flex-1 p-2 flex flex-wrap gap-2 items-center">
                  {startingHere.map(a=> {
                    const room = placeLabel(a);
                    const time = fmtTime(a.start_at) + "–" + fmtTime(a.end_at);
                    const roomColor = placeColor(a);
                    return (
                      <div key={a.id} className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[220px] shadow-sm" style={{borderLeft: `4px solid ${roomColor}`}}>
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-gray-500">{time} · {room}</div>
                        {a.patient_name && <div className="text-xs text-gray-700">{a.patient_name}</div>}
                        <div className="text-[11px] text-gray-400">{profName(a.professional_email ?? a.therapist_email ?? "", session, professionals)}</div>
                        <div className="flex gap-2 mt-2">
                          {canManage(a) && <button onClick={()=>openEdit(a)} className="text-xs border px-2 py-1 rounded hover:bg-gray-50">Editar</button>}
                          {canManage(a) && <button onClick={()=>del(a.id)} className="text-xs border px-2 py-1 rounded text-red-600 hover:bg-red-50">Excluir</button>}
                          {a.patient_whatsapp && !Number.isNaN(new Date(a.start_at).getTime()) && (
                            <a href={formatWhatsAppLink({phone:a.patient_whatsapp, title:a.title, when:new Date(a.start_at), roomLabel: room})} target="_blank" className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">WhatsApp</a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {continuingHere.map(a=> {
                    const roomColor = placeColor(a);
                    return (
                      <div key={`cont-${a.id}-${h}`} className="text-xs px-3 py-1 rounded-full border flex items-center gap-2 opacity-60" style={{borderColor: roomColor, background: `${roomColor}18`}}>
                        <span className="w-2 h-2 rounded-full" style={{background: roomColor}} />
                        {a.title} · continua ({fmtTime(a.start_at)}–{fmtTime(a.end_at)})
                      </div>
                    );
                  })}
                  {allHere.length===0 && (
                    <button onClick={()=>openNew({date,time:h, room: filterRoom ?? undefined})} className="text-xs text-gray-400 hover:text-gray-600">+ agendar às {h}</button>
                  )}
                  {allHere.length>0 && (
                    <button onClick={()=>openNew({date,time:h, room: filterRoom ?? undefined})} className="text-xs text-gray-300 hover:text-gray-500 ml-1">+</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view==="semana" && (
        <div className="bg-white border rounded-xl p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Visão geral do instituto — 7 dias</span>
            <span className="text-xs text-gray-500">Agendamentos de outros profissionais aparecem como “Reservado”, sem dados do cliente.</span>
          </div>
          {(() => {
            const wr = weekRange(date);
            const days = Array.from({length:7},(_,i)=>{ const d=new Date(wr.mon+"T12:00:00-03:00"); d.setDate(d.getDate()+i); return d.toISOString().slice(0,10); });
            return (
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                {days.map(d=> {
                  const list = items.filter(a=> {
                    const t = new Date(a.start_at);
                    return !Number.isNaN(t.getTime()) && t.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})===d;
                  }).sort((x, y) => new Date(x.start_at).getTime() - new Date(y.start_at).getTime());
                  const label = new Date(`${safeDateStr(d)}T12:00:00-03:00`).toLocaleDateString("pt-BR",{weekday:"short", day:"2-digit", month:"2-digit"});
                  const isSelected = d===date;
                  return (
                    <div key={d} className={`border rounded-lg p-2 ${isSelected?"ring-2 ring-emerald-500":""}`}>
                      <button onClick={()=>{ setDate(d); setView("dia"); }} className="text-xs font-semibold capitalize hover:underline" title="Abrir este dia">{label}</button>
                      <div className="space-y-1 mt-2">
                        {list.map(a=> {
                          const mine = canManage(a);
                          const room = placeLabel(a);
                          const roomColor = placeColor(a);
                          return (
                            <div key={a.id} className={`text-[11px] border rounded px-2 py-1 bg-white ${mine ? "" : "opacity-70"}`} style={{borderLeft: `3px solid ${roomColor}`}} title={`${a.title} ${fmtTime(a.start_at)}–${fmtTime(a.end_at)} · ${room}${mine ? "" : " (somente visualização)"}`}>
                              <div className="truncate font-medium">{fmtTime(a.start_at)} {a.title}</div>
                              <div className="truncate text-gray-500">{mine ? profName(a.professional_email ?? a.therapist_email ?? "", session, professionals) : "Reservado"}</div>
                            </div>
                          );
                        })}
                        {list.length===0 && <div className="text-[11px] text-gray-400">Livre</div>}
                        <button onClick={()=> openNew({date:d, time:"09:00"})} className="text-[11px] text-emerald-600 hover:text-emerald-700">+ agendar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-4 sm:p-6 space-y-4 my-4 sm:my-0 max-h-[92vh] overflow-auto">
            <h2 className="font-semibold text-base sm:text-lg">{editing? "Editar agendamento":"Novo agendamento"} — {fmtDateBR(fDate)}</h2>
            {formError && <div className="sticky top-0 z-10 text-sm font-medium text-red-800 bg-red-100 border-2 border-red-400 rounded-xl px-4 py-3 shadow-sm">⚠️ {formError}</div>}
            <label className="block text-sm">Título*<input value={fTitle} onChange={e=>setFTitle(e.target.value)} maxLength={120} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Ex: Reunião Equipe, Atendimento Maria" /></label>
            <label className="block text-sm">Categoria
              <select value={fCategory} onChange={e=>setFCategory(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
                <option value="atendimento">Atendimento</option>
                <option value="reuniao">Reunião</option>
                <option value="evento">Evento</option>
              </select>
            </label>
            <label className="block text-sm">Data do agendamento<input type="date" value={fDate} onChange={e=>setFDate(safeDateStr(e.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
            <div className="border-2 border-gray-300 rounded-xl p-4 bg-gray-50 space-y-3">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{contactBlockTitle}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm">{contactLabel}<input value={fCliente} onChange={e=>setFCliente(e.target.value)} maxLength={120} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder={isExternal ? "Nome do responsável" : "Nome (opcional p/ reuniões)"} /></label>
                <label className="block text-sm">WhatsApp
                  <input value={fPhone} onChange={e=>handlePhoneChange(e.target.value)} inputMode="numeric" maxLength={13} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="47999998888" />
                  {fPhoneError && <span className="text-[11px] text-red-600">{fPhoneError}</span>}
                </label>
              </div>
              <label className="block text-sm">{contactEmailLabel}
                <input type="email" value={fClientEmail} onChange={e=>handleEmailChange(e.target.value)} maxLength={120} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="cliente@email.com — recebe convite + pop-up 60/30min" />
                {fEmailError && <span className="text-[11px] text-red-600">{fEmailError}</span>}
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">Início<input type="time" value={fStart} onChange={e=>setFStart(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
              <label className="block text-sm">Fim<input type="time" value={fEnd} onChange={e=>setFEnd(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
            </div>
            <label className="block text-sm">Modalidade
              <select value={fModality} onChange={e=>setFModality(e.target.value as any)} className="mt-1 w-full border rounded-lg px-3 py-2">
                <option value="presencial">Presencial</option>
                <option value="online">Online (não ocupa sala)</option>
                <option value="externo">Evento externo — local do cliente (não ocupa sala)</option>
              </select>
            </label>
            {fModality==="presencial" && (
              <label className="block text-sm">Sala
                <select value={fRoom} onChange={e=>setFRoom(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
                  {ROOMS.map(r=> <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </label>
            )}
            {session.isAdmin && (
              <label className="block text-sm">Profissional
                <select value={fProf} onChange={e=>setFProf(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
                  <option value={session.email}>{profName(session.email, session, professionals)} (você)</option>
                  {professionals.filter(p=>p.email.toLowerCase()!==session.email.toLowerCase()).map(p=> (
                    <option key={p.email} value={p.email}>{p.name ?? p.email}</option>
                  ))}
                  {!professionals.some(p=>p.email.toLowerCase()===fProf.toLowerCase()) && fProf.toLowerCase()!==session.email.toLowerCase() && (
                    <option value={fProf}>{fProf}</option>
                  )}
                </select>
                <span className="text-[11px] text-gray-500">Para "Reunião Equipe": os 3 admins recebem o Google Calendar com pop-up 60/30min. <a href="/admin" className="underline">Cadastrar profissionais</a></span>
              </label>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={()=>setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={submit} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">{saving?"Salvando…": editing?"Salvar":"Criar"}</button>
            </div>
          </div>
        </div>
      )}

      {showPresenca && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-semibold">Marcar expediente presencial</h2>
            <p className="text-xs text-gray-500">Só informa quem estará no instituto — não bloqueia sala.</p>
            <label className="block text-sm">Data<input type="date" value={pDate} onChange={e=>setPDate(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">Início<input type="time" value={pStart} onChange={e=>setPStart(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
              <label className="block text-sm">Fim<input type="time" value={pEnd} onChange={e=>setPEnd(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
            </div>
            {session.isAdmin ? (
              <label className="block text-sm">Profissional
                <select value={pProf} onChange={e=>setPProf(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
                  <option value={session.email}>{profName(session.email, session, professionals)} (você)</option>
                  {professionals.filter(p=>p.email.toLowerCase()!==session.email.toLowerCase()).map(p=> (
                    <option key={p.email} value={p.email}>{p.name ?? p.email}</option>
                  ))}
                  {!professionals.some(p=>p.email.toLowerCase()===pProf.toLowerCase()) && pProf.toLowerCase()!==session.email.toLowerCase() && (
                    <option value={pProf}>{pProf}</option>
                  )}
                </select>
              </label>
            ) : (
              <div className="text-sm text-gray-600">Expediente de <b>{profName(session.email, session, professionals)}</b></div>
            )}
            <label className="block text-sm">Observação (opcional)<input value={pObs} onChange={e=>setPObs(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Ex: manhã, recepção" /></label>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setShowPresenca(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={submitPresenca} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
