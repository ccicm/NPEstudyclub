"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addAdHocSession(formData: FormData) {
  const hostName = String(formData.get("host_name") || "").trim();
  const date = String(formData.get("date") || "").trim();
  const time = String(formData.get("time") || "19:00").trim();
  const sessionType = String(formData.get("session_type") || "Ad-hoc").trim();
  const topic = String(formData.get("topic") || "").trim();
  const topicOther = String(formData.get("topic_other") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const videoLink = String(formData.get("video_link") || "").trim();

  if (!hostName || !date) {
    return;
  }

  const finalTopic = topic === "Other" ? topicOther : topic;
  const title = finalTopic || "Ad-hoc study session";
  const scheduledAt = new Date(`${date}T${time || "19:00"}:00`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const description = [notes ? `Notes: ${notes}` : null, `Host: ${hostName}`].filter(Boolean).join("\n");

  await supabase.from("sessions").insert({
    title,
    session_type: sessionType,
    scheduled_at: scheduledAt.toISOString(),
    description: description || null,
    video_link: videoLink || null,
    created_by: user.id,
  });

  revalidatePath("/schedule");
  revalidatePath("/dashboard");
}
