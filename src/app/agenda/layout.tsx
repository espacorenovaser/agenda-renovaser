import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function AgendaLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/agenda" className="flex items-center shrink-0" title="Voltar à agenda">
            <Image src="/logo-agenda.webp" alt="Agenda RenovaSer" width={44} height={44} className="rounded-xl" priority />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {session.isAdmin && <Link href="/admin" className="px-3 py-1.5 rounded-full bg-emerald-600 text-white font-medium hover:bg-emerald-700">+ Profissionais</Link>}
            <Image src="/logo-instituto.png" alt="Instituto RenovaSer" width={150} height={40} className="hidden md:block h-10 w-auto" priority />
            {session.isAdmin && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">admin</span>}
            <a href="/api/auth/logout" className="text-gray-500 hover:text-gray-800">Sair</a>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}