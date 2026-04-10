import { notFound } from "next/navigation";
import { CommunityThreadDetail } from "@/components/member/community-thread-detail";
import { getAdminSession } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ThreadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ reported?: string; moderated?: string; report_error?: string; error?: string }>;
}) {
  const { threadId } = await params;
  const qs = await searchParams;
  const supabase = await createClient();
  const adminSession = await getAdminSession();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("id,title,body,tag,author_name,created_at,quiz_id,publish_at,moderator_note,moderator_note_pinned,moderator_note_updated_at")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) {
    notFound();
  }

  const { data: completedQuizRows } =
    user && thread.quiz_id
      ? await supabase
          .from("quiz_results")
          .select("quiz_id")
          .eq("user_id", user.id)
          .eq("quiz_id", thread.quiz_id)
      : { data: [] as Array<{ quiz_id: string }> };

  const canViewThread =
    !thread.quiz_id || Boolean(completedQuizRows?.length) || !thread.publish_at || Date.now() >= new Date(thread.publish_at).getTime();

  if (!canViewThread) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Notice board</p>
        <h1 className="mt-2 text-3xl leading-tight">{thread.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This item opens after you finish the related quiz, or later today if you have not completed it yet.
        </p>
      </div>
    );
  }

  const { data: replies } = await supabase
    .from("forum_replies")
    .select("id,thread_id,parent_reply_id,body,author_name,created_at,created_by,was_moderated,moderated_at,moderation_reason")
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

  const replyAuthorIds = Array.from(new Set(preparedReplies.map((reply) => reply.created_by).filter(Boolean))) as string[];
  let restrictedUserIds: string[] = [];

  if (adminSession.isAdmin && replyAuthorIds.length) {
    const admin = createAdminClient();
    const { data: activeRestrictions } = await admin
      .from("forum_posting_restrictions")
      .select("user_id,expires_at")
      .in("user_id", replyAuthorIds)
      .eq("is_active", true);

    restrictedUserIds = (activeRestrictions ?? [])
      .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > Date.now())
      .map((row) => row.user_id);
  }

  return (
    <CommunityThreadDetail
      thread={{ ...thread, upvote_count: threadUpvoteCount, upvoted_by_me: threadUpvotedByMe }}
      replies={preparedReplies}
      isAdmin={adminSession.isAdmin}
      reported={qs.reported === "1"}
      moderated={qs.moderated === "1"}
      reportError={qs.report_error || null}
      errorCode={qs.error || null}
      restrictedUserIds={restrictedUserIds}
    />
  );
}
