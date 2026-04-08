import { notFound } from "next/navigation";
import { CommunityThreadDetail } from "@/components/member/community-thread-detail";
import { createClient } from "@/lib/supabase/server";

export default async function ThreadDetailPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("id,title,body,tag,author_name,created_at")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) {
    notFound();
  }

  const { data: replies } = await supabase
    .from("forum_replies")
    .select("id,thread_id,parent_reply_id,body,author_name,created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const [{ data: threadUpvotes }, { data: replyUpvotes }] = await Promise.all([
    supabase
      .from("forum_upvotes")
      .select("thread_id,user_id")
      .eq("thread_id", threadId)
      .is("reply_id", null),
    (replies ?? []).length
      ? supabase
          .from("forum_upvotes")
          .select("reply_id,user_id")
          .in("reply_id", (replies ?? []).map((reply) => reply.id))
      : Promise.resolve({ data: [] as Array<{ reply_id: string | null; user_id: string | null }> }),
  ]);

  const threadUpvoteCount = (threadUpvotes ?? []).length;
  const threadUpvotedByMe = Boolean(user && (threadUpvotes ?? []).some((entry) => entry.user_id === user.id));

  const replyUpvoteMap = new Map<string, number>();
  const replyUpvotedByMe = new Set<string>();
  (replyUpvotes ?? []).forEach((entry) => {
    if (!entry.reply_id) {
      return;
    }
    replyUpvoteMap.set(entry.reply_id, (replyUpvoteMap.get(entry.reply_id) ?? 0) + 1);
    if (user && entry.user_id === user.id) {
      replyUpvotedByMe.add(entry.reply_id);
    }
  });

  const preparedReplies = (replies ?? []).map((reply) => ({
    ...reply,
    upvote_count: replyUpvoteMap.get(reply.id) ?? 0,
    upvoted_by_me: replyUpvotedByMe.has(reply.id),
  }));

  return (
    <CommunityThreadDetail
      thread={{ ...thread, upvote_count: threadUpvoteCount, upvoted_by_me: threadUpvotedByMe }}
      replies={preparedReplies}
    />
  );
}
