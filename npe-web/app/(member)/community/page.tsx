import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type CommunityReply = {
  id: string;
  thread_id: string;
  body: string;
  author_name: string | null;
  created_at: string;
};

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

async function replyToThread(formData: FormData) {
  "use server";

  const threadId = String(formData.get("thread_id") || "").trim();
  const body = String(formData.get("body") || "").trim();

  if (!threadId || !body) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase.from("forum_replies").insert({
    thread_id: threadId,
    body,
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

  const { data: replies } = await supabase
    .from("forum_replies")
    .select("id,thread_id,body,author_name,created_at")
    .order("created_at", { ascending: true });

  const repliesByThread = (replies ?? []).reduce<Record<string, CommunityReply[]>>((accumulator, reply) => {
    const threadReplies = accumulator[reply.thread_id] ?? [];
    threadReplies.push(reply);
    accumulator[reply.thread_id] = threadReplies;
    return accumulator;
  }, {});

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
              <div className="mt-4 space-y-3 border-t pt-4">
                <div>
                  <p className="text-sm font-semibold">Replies</p>
                  {!(repliesByThread[t.id]?.length ?? 0) ? (
                    <p className="mt-1 text-sm text-muted-foreground">No replies yet.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {(repliesByThread[t.id] ?? []).map((reply) => (
                        <div key={reply.id} className="rounded-xl bg-muted p-3">
                          <p className="whitespace-pre-wrap text-sm text-foreground">{reply.body}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {reply.author_name || "Member"} · {new Date(reply.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form action={replyToThread} className="space-y-2">
                  <input type="hidden" name="thread_id" value={t.id} />
                  <textarea
                    name="body"
                    required
                    placeholder="Write a reply"
                    className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Post reply
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
