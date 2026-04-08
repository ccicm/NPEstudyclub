"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleResourceComplete(resourceId: string, completed: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  if (completed) {
    await supabase.from("user_progress").delete().eq("user_id", user.id).eq("resource_id", resourceId);
  } else {
    await supabase.from("user_progress").insert({ user_id: user.id, resource_id: resourceId });
  }

  revalidatePath("/resources");
  revalidatePath("/profile");
}
