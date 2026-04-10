"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowBigUp, CornerDownRight } from "lucide-react";
import {
  createReplyAction,
  deleteReplyAsAdminAction,
  deleteThreadAsAdminAction,
  reportContentAction,
  toggleReplyUpvoteAction,
  toggleThreadUpvoteAction,
} from "@/app/(member)/community/actions";

type Thread = {
  id: string;
  title: string;
  body: string;
  tag: string | null;
  author_name: string | null;
  created_at: string;
  quiz_id: string | null;
  publish_at: string | null;
  upvote_count: number;
  upvoted_by_me: boolean;
};

type Reply = {
  id: string;
  thread_id: string;
  parent_reply_id: string | null;
  body: string;
  author_name: string | null;
  created_at: string;
  upvote_count: number;
  upvoted_by_me: boolean;
};

function relativeTime(dateInput: string) {
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function CommunityThreadDetail({
  thread,
  replies,
  isAdmin = false,
  reported = false,
  moderated = false,
  reportError = null,
}: {
  thread: Thread;
  replies: Reply[];
  isAdmin?: boolean;
  reported?: boolean;
  moderated?: boolean;
  reportError?: string | null;
}) {
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [pendingVote, setPendingVote] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const byParent = new Map<string, Reply[]>();

    replies.forEach((reply) => {
      const key = reply.parent_reply_id ?? "root";
      const current = byParent.get(key) ?? [];
      current.push(reply);
      byParent.set(key, current);
    });

    byParent.forEach((group) => {
      group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    return byParent;
  }, [replies]);

  return (
    <div className="space-y-4">
      <Link href="/community" className="text-sm underline">
        Back to channel
      </Link>

      {reported ? (
        <p className="rounded-xl border border-primary/30 bg-accent p-3 text-sm text-accent-foreground">
          Report submitted. Moderators have been notified in-app.
        </p>
      ) : null}

      {moderated ? (
        <p className="rounded-xl border border-primary/30 bg-accent p-3 text-sm text-accent-foreground">
          Moderation action completed.
        </p>
      ) : null}

      {reportError ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Could not save your report. Please try again.
        </p>
      ) : null}

      <article className="rounded-2xl border bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{thread.tag || "General"}</p>
        <h1 className="mt-2 text-3xl leading-tight">{thread.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          {thread.author_name || "Member"} · {relativeTime(thread.created_at)}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm text-foreground">{thread.body}</p>
        <button
          type="button"
          disabled={pendingVote === `thread-${thread.id}`}
          onClick={async () => {
            setPendingVote(`thread-${thread.id}`);
            await toggleThreadUpvoteAction(thread.id);
            setPendingVote(null);
          }}
          className={`mt-4 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
            thread.upvoted_by_me ? "bg-primary/10 text-primary" : ""
          }`}
        >
          <ArrowBigUp className="h-4 w-4" /> {thread.upvote_count}
        </button>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <form action={reportContentAction}>
            <input type="hidden" name="thread_id" value={thread.id} />
            <input type="hidden" name="reason" value="Potential safeguarding/privacy issue" />
            <input type="hidden" name="return_to" value={`/community/${thread.id}`} />
            <button type="submit" className="underline">
              Report post
            </button>
          </form>
          {isAdmin ? (
            <form action={deleteThreadAsAdminAction}>
              <input type="hidden" name="thread_id" value={thread.id} />
              <button type="submit" className="text-destructive underline">
                Delete thread (moderator)
              </button>
            </form>
          ) : null}
        </div>
      </article>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-2xl">Replies</h2>

        <div className="mt-4 space-y-3">
          {(grouped.get("root") ?? []).map((reply) => (
            <div key={reply.id} className="space-y-2 rounded-xl border bg-background p-3">
              <p className="whitespace-pre-wrap text-sm">{reply.body}</p>
              <p className="text-xs text-muted-foreground">
                {reply.author_name || "Member"} · {relativeTime(reply.created_at)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pendingVote === reply.id}
                  onClick={async () => {
                    setPendingVote(reply.id);
                    await toggleReplyUpvoteAction(reply.id, thread.id);
                    setPendingVote(null);
                  }}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                    reply.upvoted_by_me ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <ArrowBigUp className="h-3.5 w-3.5" /> {reply.upvote_count}
                </button>
                <button type="button" className="text-xs underline" onClick={() => setReplyTarget(reply.id)}>
                  Reply
                </button>
                <form action={reportContentAction}>
                  <input type="hidden" name="thread_id" value={thread.id} />
                  <input type="hidden" name="reply_id" value={reply.id} />
                  <input type="hidden" name="reason" value="Potential safeguarding/privacy issue" />
                  <input type="hidden" name="return_to" value={`/community/${thread.id}`} />
                  <button type="submit" className="text-xs underline">
                    Report
                  </button>
                </form>
                {isAdmin ? (
                  <form action={deleteReplyAsAdminAction}>
                    <input type="hidden" name="reply_id" value={reply.id} />
                    <input type="hidden" name="thread_id" value={thread.id} />
                    <button type="submit" className="text-xs text-destructive underline">
                      Delete (moderator)
                    </button>
                  </form>
                ) : null}
              </div>

              {(grouped.get(reply.id) ?? []).map((nested) => (
                <div key={nested.id} className="ml-4 rounded-lg border-l-2 border-primary/40 bg-muted/30 p-3">
                  <p className="whitespace-pre-wrap text-sm">{nested.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nested.author_name || "Member"} · {relativeTime(nested.created_at)}
                  </p>
                  <button
                    type="button"
                    disabled={pendingVote === nested.id}
                    onClick={async () => {
                      setPendingVote(nested.id);
                      await toggleReplyUpvoteAction(nested.id, thread.id);
                      setPendingVote(null);
                    }}
                    className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                      nested.upvoted_by_me ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <ArrowBigUp className="h-3.5 w-3.5" /> {nested.upvote_count}
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={reportContentAction}>
                      <input type="hidden" name="thread_id" value={thread.id} />
                      <input type="hidden" name="reply_id" value={nested.id} />
                      <input type="hidden" name="reason" value="Potential safeguarding/privacy issue" />
                      <input type="hidden" name="return_to" value={`/community/${thread.id}`} />
                      <button type="submit" className="text-xs underline">
                        Report
                      </button>
                    </form>
                    {isAdmin ? (
                      <form action={deleteReplyAsAdminAction}>
                        <input type="hidden" name="reply_id" value={nested.id} />
                        <input type="hidden" name="thread_id" value={thread.id} />
                        <button type="submit" className="text-xs text-destructive underline">
                          Delete (moderator)
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}

              {replyTarget === reply.id ? (
                <form action={createReplyAction} className="mt-2 space-y-2 rounded-lg border bg-muted/20 p-3">
                  <input type="hidden" name="thread_id" value={thread.id} />
                  <input type="hidden" name="parent_reply_id" value={reply.id} />
                  <textarea name="body" required className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" />
                  <div className="flex items-center gap-2">
                    <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                      Post reply
                    </button>
                    <button type="button" onClick={() => setReplyTarget(null)} className="text-xs underline">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ))}
        </div>

        <form action={createReplyAction} className="mt-4 space-y-2 border-t pt-4">
          <input type="hidden" name="thread_id" value={thread.id} />
          <textarea
            name="body"
            required
            placeholder="Add a reply"
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button type="submit" className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            <CornerDownRight className="h-4 w-4" /> Post reply
          </button>
        </form>
      </section>
    </div>
  );
}
