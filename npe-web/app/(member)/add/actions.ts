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
  const errorObj =
    (error as { code?: string; details?: string; hint?: string } | null | undefined) || {};
  const details = String(errorObj.details || "").toLowerCase();
  const hint = String(errorObj.hint || "").toLowerCase();

  // Log for debugging
  if (process.env.NODE_ENV === "development") {
    console.error("[addResourceAction] Error details:", {
      code,
      message,
      details,
      hint,
      fullError: error,
    });
  }

  // Check for RLS/permission errors in multiple places
  if (
    code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("new row violates row-level security") ||
    hint.includes("row-level") ||
    errorObj.code === "PGRST200"
  ) {
    return "not_authorized";
  }

  // Only classify as schema_not_ready for genuine schema errors
  if (code === "42P01") {
    // Table doesn't exist
    return "schema_not_ready";
  }

  if (code === "PGRST204") {
    return "schema_not_ready";
  }

  if (
    code === "42703" &&
    !message.includes("modality") &&
    !message.includes("population") &&
    !message.includes("content_type") &&
    !message.includes("source") &&
    !message.includes("tags")
  ) {
    // Column doesn't exist (but not a metadata column we expect)
    return "schema_not_ready";
  }

  if (
    message.includes("undefined table") ||
    (message.includes("relation") && message.includes("does not exist"))
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

  return (
    lower.includes("undefined column") ||
    lower.includes("schema cache") ||
    (lower.includes("could not find the") && lower.includes("column"))
  );
}

function getDbDiagnostic(error: { message?: string; code?: string; details?: string; hint?: string }): {
  dbCode: string;
  dbHint: string;
  dbColumn: string;
} {
  const code = String(error.code || "unknown").toUpperCase();
  const message = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  const hint = String(error.hint || "").toLowerCase();
  const match = `${message} ${details} ${hint}`.match(/column\s+['"]?([a-z_][a-z0-9_]*)['"]?/i);
  const dbColumn = match?.[1] || "";

  if (
    code === "42501" ||
    message.includes("row-level") ||
    message.includes("permission denied") ||
    details.includes("policy") ||
    hint.includes("policy")
  ) {
    return { dbCode: code, dbHint: "rls_policy", dbColumn };
  }

  if (code === "23503" || message.includes("foreign key")) {
    return { dbCode: code, dbHint: "foreign_key", dbColumn };
  }

  if (code === "23502" || message.includes("null value")) {
    return { dbCode: code, dbHint: "not_null", dbColumn };
  }

  if (code === "42703" || code === "PGRST204" || message.includes("undefined column")) {
    return { dbCode: code, dbHint: "missing_column", dbColumn };
  }

  if (code === "42P01" || message.includes("relation") || message.includes("does not exist")) {
    return { dbCode: code, dbHint: "missing_table", dbColumn };
  }

  return { dbCode: code, dbHint: "unknown", dbColumn };
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

  const normalizedEmail = (user.email || "").toLowerCase();
  const { data: approvalRow } = await supabase
    .from("approved_users")
    .select("email,status")
    .eq("email", normalizedEmail)
    .eq("status", "approved")
    .maybeSingle();

  if (!approvalRow) {
    redirect("/add?error=not_authorized");
  }

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
    {
      title,
      category,
      uploaded_by: user.id,
    },
  ];

  let error: { message?: string; code?: string } | null = null;

  // Verify user context is preserved for RLS
  const { data: sessionCheck } = await supabase.auth.getUser();
  if (!sessionCheck.user) {
    redirect("/auth/login");
  }

  // Use user's own Supabase client (preserves auth context for RLS)
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

    // Log full error for debugging
    const errorMessage = String(error.message || "");
    const errorCode = String(error.code || "");
    const hint =
      errorMessage.includes("permission") || errorMessage.includes("row-level")
        ? `RLS_HINT: ${errorMessage}`
        : "";
    if (process.env.NODE_ENV === "development") {
      console.error("[addResourceAction] Insert failed:", {
        code: errorCode,
        message: errorMessage,
        hint,
      });
    }

    const classified = classifyError(error);
    const { dbCode, dbHint, dbColumn } = getDbDiagnostic(error);
    redirect(
      `/add?error=${classified}&db_code=${encodeURIComponent(dbCode)}&db_hint=${encodeURIComponent(dbHint)}&db_col=${encodeURIComponent(dbColumn)}`,
    );
  }

  revalidatePath("/resources");
  revalidatePath("/dashboard");
  redirect("/add?uploaded=1");
}
