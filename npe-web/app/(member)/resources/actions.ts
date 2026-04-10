"use server";

import { revalidatePath } from "next/cache";
import { isApprovedMember } from "@/lib/access";
import { createResourceSignedUrl } from "@/lib/storage";
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

export async function getResourceDownloadUrlAction(resourceId: string) {
  const membership = await isApprovedMember();

  if (!membership.user) {
    throw new Error("Not authenticated");
  }

  if (!membership.approved) {
    throw new Error("Not authorized");
  }

  const supabase = await createClient();
  const { data: resource, error } = await supabase
    .from("resources")
    .select("id,file_path")
    .eq("id", resourceId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load resource file path");
  }

  if (!resource?.file_path) {
    throw new Error("No file attached");
  }

  const signedUrl = await createResourceSignedUrl({
    supabase,
    objectKey: resource.file_path,
    expiresInSeconds: 120,
  });

  if (!signedUrl) {
    throw new Error("Could not create download URL");
  }

  return signedUrl;
}
