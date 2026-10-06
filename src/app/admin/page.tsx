import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminClient from "@/components/admin/AdminClient";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (!session.isAdmin) redirect("/agenda");
  return <AdminClient session={session} />;
}
