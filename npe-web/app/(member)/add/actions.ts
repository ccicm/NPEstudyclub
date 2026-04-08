"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function normalizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function optional(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value || null;
}

function fromSelectWithOther(formData: FormData, key: string) {
  const selected = String(formData.get(key) || "").trim();
  if (selected !== "Other") {
    return selected || null;
  }
  const otherValue = String(formData.get(`${key}_other`) || "").trim();
  return otherValue || null;
}

export async function addResourceAction(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const notes = optional(formData, "notes");
  const source = optional(formData, "source");
  const fileInput = formData.get("file");

  const domain = fromSelectWithOther(formData, "domain");
  const modality = fromSelectWithOther(formData, "modality");
  const population = fromSelectWithOther(formData, "population");
  const contentType = fromSelectWithOther(formData, "content_type");

  if (!title || !category || !(fileInput instanceof File) || fileInput.size === 0) {
    redirect("/add?error=missing_required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const safeName = normalizeFileName(fileInput.name || "resource-file");
  const storagePath = `${user.id}/${Date.now()}-${safeName}`;
  const fileBuffer = Buffer.from(await fileInput.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from("resources").upload(storagePath, fileBuffer, {
    contentType: fileInput.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    redirect("/add?error=upload_failed");
  }

  const fileType = fileInput.name.includes(".") ? fileInput.name.split(".").pop() || null : null;

  const tags = [domain, modality, population, contentType]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean);

  const { error } = await supabase.from("resources").insert({
    title,
    category,
    domain,
    modality,
    population,
    content_type: contentType,
    source,
    notes,
    tags: tags.length ? tags : null,
    file_path: storagePath,
    file_type: fileType,
    uploaded_by: user.id,
    uploader_name: user.user_metadata?.full_name || user.email,
  });

  if (error) {
    redirect("/add?error=save_failed");
  }

  revalidatePath("/resources");
  revalidatePath("/dashboard");
  redirect("/add?uploaded=1");
}
