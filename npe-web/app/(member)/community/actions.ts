"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin-access";
import { normalizeChannel } from "@/lib/community";
import { createAdminClient } from "@/lib/supabase/admin";

function classifyError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("permission denied")) return "not_authorized";
  if (lower.includes("does not exist") || lower.includes("undefined table") || lower.includes("undefined column")) {
    return "schema_not_ready";
  }
  return null;
}

async function getPostingRestrictionReason(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("forum_posting_restrictions")
    .select("reason,expires_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }

  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return data.reason || "Posting is temporarily restricted by a moderator.";
}

export async function createThreadAction(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const tag = String(formData.get("tag") || "General").trim();
  const channel = normalizeChannel(String(formData.get("channel") || "announcements"));

  if (!title || !body) {
    redirect(`/community?error=missing_required&channel=${encodeURIComponent(channel)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const restriction = await getPostingRestrictionReason(user.id);
  if (restriction) {
    redirect(`/community?error=posting_restricted&channel=${encodeURIComponent(channel)}`);
  }

  const { error } = await supabase.from("forum_threads").insert({
    title,
    body,
    tag,
    channel,
    created_by: user.id,
    author_name: user.user_metadata?.full_name || user.email,
  });

  if (error) {
    const classified = classifyError(error.message || "");
    if (classified) {
      redirect(`/community?error=${classified}&channel=${encodeURIComponent(channel)}`);
    }
    redirect(`/community?error=save_failed&channel=${encodeURIComponent(channel)}`);
  }

  revalidatePath("/community");
  redirect(`/community?created=1&channel=${encodeURIComponent(channel)}`);
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

  const restriction = await getPostingRestrictionReason(user.id);
  if (restriction) {
    redirect(`/community/${threadId}?error=posting_restricted`);
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

export async function reportContentAction(formData: FormData) {
  const threadId = String(formData.get("thread_id") || "").trim();
  const replyId = String(formData.get("reply_id") || "").trim();
  const reason = String(formData.get("reason") || "Potential safeguarding/privacy issue").trim();
  const returnTo = String(formData.get("return_to") || "/community").trim();

  if (!threadId && !replyId) {
    redirect(`${returnTo}?report_error=missing_target`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const payload = {
    thread_id: threadId || null,
    reply_id: replyId || null,
    reporter_id: user.id,
    reason: reason || "Potential safeguarding/privacy issue",
  };

  const { error } = await supabase.from("content_reports").insert(payload);

  if (error) {
    redirect(`${returnTo}?report_error=save_failed`);
  }

  revalidatePath("/community");
  if (threadId) {
    revalidatePath(`/community/${threadId}`);
  }

  redirect(`${returnTo}?reported=1`);
}

export async function deleteThreadAsAdminAction(formData: FormData) {
  const threadId = String(formData.get("thread_id") || "").trim();
  if (!threadId) {
    return;
  }

  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return;
  }

  const supabase = await createClient();
  await supabase.from("forum_threads").delete().eq("id", threadId);

  revalidatePath("/community");
  redirect("/community?moderated=1");
}

export async function deleteReplyAsAdminAction(formData: FormData) {
  const replyId = String(formData.get("reply_id") || "").trim();
  const threadId = String(formData.get("thread_id") || "").trim();

  if (!replyId || !threadId) {
    return;
  }

  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return;
  }

  const supabase = await createClient();
  await supabase.from("forum_replies").delete().eq("id", replyId);

  revalidatePath("/community");
  revalidatePath(`/community/${threadId}`);
  redirect(`/community/${threadId}?moderated=1`);
}

export async function setThreadModeratorNoteAction(formData: FormData) {
  const threadId = String(formData.get("thread_id") || "").trim();
  const note = String(formData.get("moderator_note") || "").trim();

  if (!threadId || !note) {
    return;
  }

  const session = await getAdminSession();
  if (!session.isAdmin || !session.user) {
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("forum_threads")
    .update({
      moderator_note: note,
      moderator_note_pinned: true,
      moderator_note_updated_by: session.user.id,
      moderator_note_updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  revalidatePath("/community");
  revalidatePath(`/community/${threadId}`);
  redirect(`/community/${threadId}?moderated=1`);
}

export async function clearThreadModeratorNoteAction(formData: FormData) {
  const threadId = String(formData.get("thread_id") || "").trim();
  if (!threadId) {
    return;
  }

  const session = await getAdminSession();
  if (!session.isAdmin || !session.user) {
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("forum_threads")
    .update({
      moderator_note: null,
      moderator_note_pinned: false,
      moderator_note_updated_by: session.user.id,
      moderator_note_updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  revalidatePath("/community");
  revalidatePath(`/community/${threadId}`);
  redirect(`/community/${threadId}?moderated=1`);
}

export async function redactReplyAsAdminAction(formData: FormData) {
  const replyId = String(formData.get("reply_id") || "").trim();
  const threadId = String(formData.get("thread_id") || "").trim();
  const redactedBody = String(formData.get("redacted_body") || "").trim();
  const moderationReason = String(formData.get("moderation_reason") || "Clinical safeguarding redaction").trim();

  if (!replyId || !threadId || !redactedBody) {
    return;
  }

  const session = await getAdminSession();
  if (!session.isAdmin || !session.user) {
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("forum_replies")
    .update({
      body: redactedBody,
      was_moderated: true,
      moderated_by: session.user.id,
      moderated_at: new Date().toISOString(),
      moderation_reason: moderationReason,
    })
    .eq("id", replyId);

  revalidatePath("/community");
  revalidatePath(`/community/${threadId}`);
  redirect(`/community/${threadId}?moderated=1`);
}

export async function restrictMemberPostingAsAdminAction(formData: FormData) {
  const userId = String(formData.get("user_id") || "").trim();
  const threadId = String(formData.get("thread_id") || "").trim();
  const reason = String(formData.get("reason") || "Posting restricted by moderator").trim();
  const days = Number(String(formData.get("days") || "7").trim() || "7");

  if (!userId || !threadId) {
    return;
  }

  const session = await getAdminSession();
  if (!session.isAdmin || !session.user) {
    return;
  }

  const expiresAt = new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  await admin
    .from("forum_posting_restrictions")
    .insert({
      user_id: userId,
      is_active: true,
      reason,
      expires_at: expiresAt,
      created_by: session.user.id,
    });

  revalidatePath("/community");
  revalidatePath(`/community/${threadId}`);
  redirect(`/community/${threadId}?moderated=1`);
}
