import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count: completedCount } = await supabase
    .from("user_progress")
    .select("id", { count: "exact", head: true });

  const { count: totalCount } = await supabase
    .from("resources")
    .select("id", { count: "exact", head: true });

  const done = completedCount || 0;
  const total = totalCount || 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Profile</h1>
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <p className="mt-3 text-sm">{done} of {total} resources completed</p>
        <div className="mt-2 h-2 w-full rounded bg-muted">
          <div className="h-2 rounded bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
