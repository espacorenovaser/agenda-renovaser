import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AgendaClient from "@/components/agenda/AgendaClient";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");

  const params = await searchParams;
  const view = params.view === "semana" ? "semana" : "dia";
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  return <AgendaClient initialView={view} initialDate={date} session={session} />;
}
