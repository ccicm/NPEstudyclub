"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowBigUp, Circle } from "lucide-react";
import { COMMUNITY_CHANNELS, COMMUNITY_TAGS, type CommunityChannelKey } from "@/lib/community";
import { toggleThreadUpvoteAction } from "@/app/(member)/community/actions";

type ThreadSummary = {
  id: string;
  title: string;
  body: string;
  tag: string | null;
  channel: CommunityChannelKey;
  author_name: string | null;
  is_pinned: boolean | null;
  updated_at: string;
  created_at: string;
  reply_count: number;
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

export function CommunityHub({
  threads,
  createThreadAction,
}: {
  threads: ThreadSummary[];
  createThreadAction: (formData: FormData) => Promise<void>;
}) {
  const [activeChannel, setActiveChannel] = useState<CommunityChannelKey>("announcements");
  const [showComposer, setShowComposer] = useState(false);
  const [isPendingVote, setIsPendingVote] = useState<string | null>(null);

  useEffect(() => {
    const key = `community-last-seen-${activeChannel}`;
    localStorage.setItem(key, new Date().toISOString());
  }, [activeChannel]);

  const unreadByChannel = useMemo(() => {
    if (typeof window === "undefined") {
      return new Map<CommunityChannelKey, boolean>();
    }

    const map = new Map<CommunityChannelKey, boolean>();

    COMMUNITY_CHANNELS.forEach((channel) => {
      const lastSeenRaw = localStorage.getItem(`community-last-seen-${channel.key}`);
      const lastSeen = lastSeenRaw ? new Date(lastSeenRaw).getTime() : 0;
      const hasUnread = threads.some(
        (thread) => thread.channel === channel.key && new Date(thread.updated_at).getTime() > lastSeen,
      );
      map.set(channel.key, hasUnread);
    });

    return map;
  }, [threads]);

  const visibleThreads = useMemo(() => {
    return threads
      .filter((thread) => thread.channel === activeChannel)
      .sort((left, right) => {
        if (Boolean(left.is_pinned) !== Boolean(right.is_pinned)) {
          return left.is_pinned ? -1 : 1;
        }
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      });
  }, [activeChannel, threads]);

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-2xl border bg-card p-3">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channels</p>
        <nav className="space-y-1">
          {COMMUNITY_CHANNELS.map((channel) => {
            const active = channel.key === activeChannel;
            return (
              <button
                key={channel.key}
                type="button"
                onClick={() => setActiveChannel(channel.key)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <span>
                  {channel.icon} {channel.name}
                </span>
                {!active && unreadByChannel.get(channel.key) ? <Circle className="h-2.5 w-2.5 fill-current" /> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="space-y-4">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl">
                {COMMUNITY_CHANNELS.find((channel) => channel.key === activeChannel)?.name || "Community"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {COMMUNITY_CHANNELS.find((channel) => channel.key === activeChannel)?.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowComposer((previous) => !previous)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              + New Post
            </button>
          </div>

          {showComposer ? (
            <form action={createThreadAction} className="mt-4 grid gap-3 rounded-xl border bg-muted/20 p-4">
              <label className="grid gap-1 text-sm">
                <span>Channel</span>
                <select name="channel" defaultValue={activeChannel} className="h-10 rounded-md border bg-background px-3">
                  {COMMUNITY_CHANNELS.map((channel) => (
                    <option key={channel.key} value={channel.key}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span>Tag</span>
                <select name="tag" className="h-10 rounded-md border bg-background px-3">
                  {COMMUNITY_TAGS.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span>Title</span>
                <input name="title" required className="h-10 rounded-md border bg-background px-3" />
              </label>
              <label className="grid gap-1 text-sm">
                <span>Body</span>
                <textarea name="body" required className="min-h-28 rounded-md border bg-background px-3 py-2" />
              </label>
              <div>
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Publish post
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {!visibleThreads.length ? (
          <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
            No posts yet in this channel.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleThreads.map((thread) => (
              <article key={thread.id} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-accent px-2 py-1 text-accent-foreground">{thread.tag || "General"}</span>
                  {thread.is_pinned ? <span className="rounded-full bg-secondary px-2 py-1">Pinned</span> : null}
                </div>
                <h2 className="mt-2 text-xl">
                  <Link href={`/community/${thread.id}`} className="hover:underline">
                    {thread.title}
                  </Link>
                </h2>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{thread.body}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <p>
                    {thread.author_name || "Member"} · {relativeTime(thread.updated_at)}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isPendingVote === thread.id}
                      onClick={async () => {
                        setIsPendingVote(thread.id);
                        await toggleThreadUpvoteAction(thread.id);
                        setIsPendingVote(null);
                      }}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${
                        thread.upvoted_by_me ? "bg-primary/10 text-primary" : ""
                      }`}
                    >
                      <ArrowBigUp className="h-3.5 w-3.5" /> {thread.upvote_count}
                    </button>
                    <span>{thread.reply_count} replies</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
