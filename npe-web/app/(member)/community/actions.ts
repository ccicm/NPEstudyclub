"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeChannel } from "@/lib/community";

export async function createThreadAction(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const tag = String(formData.get("tag") || "General").trim();
  const channel = normalizeChannel(String(formData.get("channel") || "announcements"));

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
    channel,
    created_by: user.id,
    author_name: user.user_metadata?.full_name || user.email,
  });

  revalidatePath("/community");
}

export async function createReplyAction(formData: FormData) {
  const threadId = String(formData.get("thread_id") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const parentReplyId = String(formData.get("parent_reply_id") || "").trim();

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

  let normalizedParent: string | null = null;

  if (parentReplyId) {
    const { data: parent } = await supabase
      .from("forum_replies")
      .select("id,parent_reply_id")
      .eq("id", parentReplyId)
      .maybeSingle();

    if (!parent) {
      return;
    }

    if (parent.parent_reply_id) {
      return;
    }

    normalizedParent = parent.id;
  }

  await supabase.from("forum_replies").insert({
    thread_id: threadId,
    parent_reply_id: normalizedParent,
    body,
    created_by: user.id,
    author_name: user.user_metadata?.full_name || user.email,
  });

  revalidatePath("/community");
  revalidatePath(`/community/${threadId}`);
}

export async function toggleThreadUpvoteAction(threadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !threadId) {
    return;
  }

  const { data: existing } = await supabase
    .from("forum_upvotes")
    .select("id")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("forum_upvotes").delete().eq("id", existing.id);
  } else {
    await supabase.from("forum_upvotes").insert({ user_id: user.id, thread_id: threadId });
  }

  revalidatePath("/community");
  revalidatePath(`/community/${threadId}`);
}

export async function toggleReplyUpvoteAction(replyId: string, threadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !replyId) {
    return;
  }

  const { data: existing } = await supabase
    .from("forum_upvotes")
    .select("id")
    .eq("reply_id", replyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("forum_upvotes").delete().eq("id", existing.id);
  } else {
    await supabase.from("forum_upvotes").insert({ user_id: user.id, reply_id: replyId });
  }

  revalidatePath("/community");
  revalidatePath(`/community/${threadId}`);
}
