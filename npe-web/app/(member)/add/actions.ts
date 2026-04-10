"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteResourceObject } from "@/lib/storage";
import { uploadResourceObject } from "@/lib/storage";
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

function classifyError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toUpperCase();

  if (code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
    return "not_authorized";
  }

  if (code === "42P01" || code === "42703" || code === "PGRST204") {
    return "schema_not_ready";
  }

  if (
    message.includes("undefined table") ||
    message.includes("undefined column") ||
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("schema cache") ||
    (message.includes("could not find the") && message.includes("column"))
  ) {
    return "schema_not_ready";
  }

  return "save_failed";
}

function isMissingMetadataColumnError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || "");
  const lower = message.toLowerCase();
  const code = String(error?.code || "").toUpperCase();

  if (code === "42703" || code === "PGRST204") {
    return true;
  }

  if (
    !lower.includes("undefined column") &&
    !lower.includes("schema cache") &&
    !(lower.includes("could not find the") && lower.includes("column"))
  ) {
    return false;
  }

  return (
    lower.includes("modality") ||
    lower.includes("population") ||
    lower.includes("content_type") ||
    lower.includes("source")
  );
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

  const uploadResult = await uploadResourceObject({
    supabase,
    objectKey: storagePath,
    body: fileBuffer,
    contentType: fileInput.type || "application/octet-stream",
  });

  if (!uploadResult.ok) {
    redirect(`/add?error=${uploadResult.code}`);
  }

  const fileType = fileInput.name.includes(".") ? fileInput.name.split(".").pop() || null : null;

  const tags = [domain, modality, population, contentType]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean);

  const baseInsert = {
    title,
    category,
    domain,
    notes,
    tags: tags.length ? tags : null,
    file_path: storagePath,
    file_type: fileType,
    uploaded_by: user.id,
    uploader_name: user.user_metadata?.full_name || user.email,
  };

  const insertAttempts: Array<Record<string, unknown>> = [
    {
      ...baseInsert,
      modality,
      population,
      content_type: contentType,
      source,
    },
    baseInsert,
    {
      title,
      category,
      file_path: storagePath,
      file_type: fileType,
      uploaded_by: user.id,
      uploader_name: user.user_metadata?.full_name || user.email,
    },
  ];

  let error: { message?: string; code?: string } | null = null;

  for (const payload of insertAttempts) {
    const { error: attemptError } = await supabase.from("resources").insert(payload);
    if (!attemptError) {
      error = null;
      break;
    }

    error = attemptError;

    if (!isMissingMetadataColumnError(attemptError)) {
      break;
    }
  }

  if (error) {
    await deleteResourceObject({
      supabase,
      objectKey: storagePath,
    });

    const classified = classifyError(error);
    redirect(`/add?error=${classified}`);
  }

  revalidatePath("/resources");
  revalidatePath("/dashboard");
  redirect("/add?uploaded=1");
}
