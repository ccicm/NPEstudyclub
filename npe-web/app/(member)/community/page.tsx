import { CommunityHub } from "@/components/member/community-hub";
import { createClient } from "@/lib/supabase/server";
import { normalizeChannel } from "@/lib/community";
import { createThreadAction } from "./actions";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ author?: string; error?: string; created?: string; channel?: string }>;
}) {
  const params = await searchParams;
  const mineOnly = params.author === "me";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: threads } = await supabase
    .from("forum_threads")
    .select("id,title,body,tag,channel,author_name,is_pinned,updated_at,created_at,created_by")
    .order("updated_at", { ascending: false })
    .limit(200);

  const threadIds = (threads ?? []).map((thread) => thread.id);

  const [{ data: replies }, { data: upvotes }] = await Promise.all([
    threadIds.length
      ? supabase.from("forum_replies").select("id,thread_id").in("thread_id", threadIds)
      : Promise.resolve({ data: [] as Array<{ id: string; thread_id: string }> }),
    threadIds.length
      ? supabase
          .from("forum_upvotes")
          .select("thread_id,user_id")
          .in("thread_id", threadIds)
          .is("reply_id", null)
      : Promise.resolve({ data: [] as Array<{ thread_id: string; user_id: string | null }> }),
  ]);

  const replyCountMap = new Map<string, number>();
  (replies ?? []).forEach((reply) => {
    replyCountMap.set(reply.thread_id, (replyCountMap.get(reply.thread_id) ?? 0) + 1);
  });

  const upvoteCountMap = new Map<string, number>();
  const upvotedByMe = new Set<string>();
  (upvotes ?? []).forEach((entry) => {
    if (!entry.thread_id) {
      return;
    }
    upvoteCountMap.set(entry.thread_id, (upvoteCountMap.get(entry.thread_id) ?? 0) + 1);
    if (user && entry.user_id === user.id) {
      upvotedByMe.add(entry.thread_id);
    }
  });

  const preparedThreads = (threads ?? []).map((thread) => ({
    ...thread,
    channel: normalizeChannel(thread.channel),
    reply_count: replyCountMap.get(thread.id) ?? 0,
    upvote_count: upvoteCountMap.get(thread.id) ?? 0,
    upvoted_by_me: upvotedByMe.has(thread.id),
  }));

  const visibleThreads = mineOnly && user
    ? preparedThreads.filter((thread) => thread.created_by === user.id)
    : preparedThreads;

  return (
    <CommunityHub
      threads={visibleThreads}
      createThreadAction={createThreadAction}
      showingMine={mineOnly}
      errorCode={params.error || null}
      created={params.created === "1"}
      initialChannel={normalizeChannel(params.channel || "announcements")}
    />
  );
}
