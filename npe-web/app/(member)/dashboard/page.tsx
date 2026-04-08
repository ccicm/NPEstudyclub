import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id,title,session_type,scheduled_at")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(3);

  const { data: recentResources } = await supabase
    .from("resources")
    .select("id,title,category,created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.32fr_0.68fr]">
      <aside className="rounded-2xl border bg-card p-6">
        <h1 className="text-3xl">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Approved member space for NPE Study Club.
        </p>
      </aside>

      <section className="space-y-6">
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Upcoming Sessions</h2>
          {!sessions?.length ? (
            <p className="mt-2 text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-lg bg-muted p-3">
                  <p className="font-semibold">{s.title || "Study session"}</p>
                  <p className="text-muted-foreground">
                    {new Date(s.scheduled_at).toLocaleString()} - {s.session_type}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Recently Added Resources</h2>
          {!recentResources?.length ? (
            <p className="mt-2 text-sm text-muted-foreground">No resources yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {recentResources.map((r) => (
                <li key={r.id} className="rounded-lg bg-muted p-3">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-muted-foreground">{r.category}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
