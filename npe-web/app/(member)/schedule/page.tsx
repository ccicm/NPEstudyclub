import { createClient } from "@/lib/supabase/server";

export default async function SchedulePage() {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id,title,session_type,scheduled_at,description")
    .order("scheduled_at", { ascending: true })
    .limit(50);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Schedule</h1>
      <p className="text-sm text-muted-foreground">
        Study sessions are scheduled weekly. Ad-hoc sessions are added by members and visible to everyone.
      </p>
      {!sessions?.length ? (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">No sessions yet.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-2xl border bg-card p-4">
              <p className="font-semibold">{s.title || "Session"}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(s.scheduled_at).toLocaleString()} - {s.session_type}
              </p>
              {s.description ? <p className="mt-2 text-sm text-muted-foreground">{s.description}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
