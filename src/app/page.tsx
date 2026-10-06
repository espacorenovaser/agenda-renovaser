import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function Home({ searchParams }: { searchParams: Promise<{ login?: string }> }) {
  const params = await searchParams;
  const isLogged = params?.login === "success";
  const session = await getSession();

  if (session) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow p-8 text-center">
          <p className="text-sm text-gray-600">Olá, {session.name}</p>
          <Link href="/agenda" className="mt-4 inline-flex w-full justify-center px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg">Abrir agenda</Link>
          <a href="/api/auth/logout" className="mt-3 inline-block text-sm text-gray-500">Sair</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Agenda Interna</h1>
        <p className="text-gray-600 mt-1 text-sm">Instituto RenovaSer — salas, auditório e Google Agenda</p>
        {isLogged ? (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mt-6">
            <p className="font-semibold">✅ Conectado!</p>
            <Link href="/agenda" className="text-sm underline">Ir para a agenda</Link>
          </div>
        ) : (
          <Link href="/api/auth/google" className="mt-6 inline-flex w-full justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow">
            Conectar com Google
          </Link>
        )}
      </div>
    </main>
  );
}
