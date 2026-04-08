import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function createThread(formData: FormData) {
  "use server";

  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const tag = String(formData.get("tag") || "general").trim().toLowerCase();

  if (!title || !body) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase.from("forum_threads").insert({
    title,
    body,
    tag,
    created_by: user.id,
    author_name: user.user_metadata?.full_name || user.email,
  });

  revalidatePath("/community");
}

export default async function CommunityPage() {
  const supabase = await createClient();
  const { data: threads } = await supabase
    .from("forum_threads")
    .select("id,title,body,tag,author_name,is_pinned,updated_at")
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Community Noticeboard</h1>
        <p className="text-sm text-muted-foreground">
          Announcements, exam updates, and peer discussion for approved members.
        </p>
      </div>

      <form action={createThread} className="rounded-2xl border bg-card p-6">
        <h2 className="text-2xl">New Post</h2>
        <div className="mt-4 grid gap-3">
          <input
            name="title"
            required
            placeholder="Post title"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <select name="tag" className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="announcement">Announcement</option>
            <option value="question">Question</option>
            <option value="resource-request">Resource request</option>
            <option value="general">General</option>
          </select>
          <textarea
            name="body"
            required
            placeholder="Write your update or question"
            className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Publish post
          </button>
        </div>
      </form>

      {!threads?.length ? (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          No posts yet. Start the conversation with a first update or question.
        </p>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => (
            <article key={t.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-accent px-2 py-1 text-accent-foreground">{t.tag || "general"}</span>
                {t.is_pinned ? <span className="rounded-full bg-secondary px-2 py-1">Pinned</span> : null}
              </div>
              <h2 className="mt-3 text-xl">{t.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t.author_name || "Member"} · {new Date(t.updated_at).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
