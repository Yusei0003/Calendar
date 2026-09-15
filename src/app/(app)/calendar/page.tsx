import { getActorId } from "@/lib/auth";
import { getStore } from "@/lib/db";

export default async function CalendarPage() {
  const actorId = await getActorId();
  const staff = await getStore().listStaff();
  const me = staff.find((member) => member.id === actorId);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">カレンダー</h1>
      <p className="mt-2 text-sm text-ink-muted">ようこそ、{me?.name} さん。</p>
    </main>
  );
}
