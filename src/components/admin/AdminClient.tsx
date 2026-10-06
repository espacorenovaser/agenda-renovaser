"use client";

import { useEffect, useState } from "react";
import type { Session } from "@/lib/auth";

type Professional = { email: string; name: string | null; role: string; whatsapp?: string | null; area_atuacao?: string | null };

export default function AdminClient({ session }: { session: Session }) {
  const [list, setList] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editArea, setEditArea] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/professionals");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao carregar");
      setLoading(false);
      return;
    }
    setList(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Informe nome e e-mail");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/professionals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), name: name.trim(), whatsapp: whatsapp.trim(), area_atuacao: area.trim() }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Erro ao salvar");
      return;
    }
    if (data._aviso) setError(data._aviso);
    setEmail("");
    setName("");
    setWhatsapp("");
    setArea("");
    load();
  }

  async function saveEdit(target: string) {
    if (!editName.trim()) {
      setError("Informe o nome");
      return;
    }
    const res = await fetch("/api/professionals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: target, name: editName.trim(), whatsapp: editWhatsapp.trim(), area_atuacao: editArea.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao salvar");
      return;
    }
    if (data._aviso) setError(data._aviso);
    setEditing(null);
    load();
  }

  async function remove(target: string) {
    if (!confirm(`Excluir ${target}? Os expedientes dele(a) também saem da lista.`)) return;
    const res = await fetch(`/api/professionals?email=${encodeURIComponent(target)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao excluir");
      return;
    }
    load();
  }

  const admins = list.filter((p) => p.role === "admin");
  const pros = list.filter((p) => p.role !== "admin");

  return (
    <div className="space-y-6">
      <a href="/agenda" className="text-sm text-gray-500 hover:text-gray-800">← Voltar à agenda</a>
      <div>
        <h1 className="text-xl font-bold">Admin — Profissionais</h1>
        <p className="text-sm text-gray-500">Logado como {session.name}. Só admins veem esta página.</p>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-sm mb-1">Cadastrar profissional</h2>
        <p className="text-xs text-gray-500 mb-3">Entra no dropdown de “Profissional” da agenda. O login dele continua pelo Google.</p>
        <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome (ex: Ana Souza)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            type="email"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="WhatsApp (ex: 47999998888)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Área de atuação (ex: Psicologia, Fisioterapia)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button disabled={saving} className="md:col-span-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">
            {saving ? "Salvando…" : "Adicionar"}
          </button>
        </form>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-sm mb-3">Profissionais cadastrados ({pros.length})</h2>
        {loading ? (
          <div className="text-sm text-gray-500">Carregando…</div>
        ) : pros.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhum ainda — cadastre o primeiro acima.</div>
        ) : (
          <ul className="divide-y">
            {pros.map((p) => (
              <li key={p.email} className="py-2 text-sm">
                {editing === p.email ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nome"
                      className="border rounded-lg px-3 py-1.5 text-sm"
                    />
                    <input
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(e.target.value)}
                      placeholder="WhatsApp"
                      className="border rounded-lg px-3 py-1.5 text-sm"
                    />
                    <input
                      value={editArea}
                      onChange={(e) => setEditArea(e.target.value)}
                      placeholder="Área de atuação"
                      className="border rounded-lg px-3 py-1.5 text-sm"
                    />
                    <div className="md:col-span-3 flex gap-2">
                      <button onClick={() => saveEdit(p.email)} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg">
                        Salvar
                      </button>
                      <button onClick={() => setEditing(null)} className="text-xs border px-3 py-1.5 rounded-lg">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate" title={[p.name ?? p.email, p.name ? p.email : null, p.area_atuacao, p.whatsapp].filter(Boolean).join("  -  ")}>
                        {[p.name ?? p.email, p.name ? p.email : null, p.area_atuacao, p.whatsapp].filter(Boolean).join("  -  ")}
                      </div>
                    </div>
                    <span className="ml-auto flex gap-2">
                      <button
                        onClick={() => {
                          setEditing(p.email);
                          setEditName(p.name ?? "");
                          setEditWhatsapp(p.whatsapp ?? "");
                          setEditArea(p.area_atuacao ?? "");
                        }}
                        className="text-xs border px-2 py-1 rounded hover:bg-gray-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(p.email)}
                        className="text-xs border px-2 py-1 rounded text-red-600 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-sm mb-2">Admins ({admins.length})</h2>
        <p className="text-xs text-gray-500 mb-2">Fixos pelo login do Google — não editáveis aqui.</p>
        <ul className="text-sm space-y-1">
          {admins.map((a) => (
            <li key={a.email}>
              <span className="font-medium">{a.name ?? a.email}</span> <span className="text-gray-500">{a.email}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
