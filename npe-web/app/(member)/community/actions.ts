"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin-access";
import { normalizeChannel } from "@/lib/community";

function classifyError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("permission denied")) return "not_authorized";
  if (lower.includes("does not exist") || lower.includes("undefined table") || lower.includes("undefined column")) {
    return "schema_not_ready";
  }
  return null;
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
