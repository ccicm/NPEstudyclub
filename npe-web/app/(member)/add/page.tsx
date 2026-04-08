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

async function addResource(formData: FormData) {
  "use server";

  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const rawTags = String(formData.get("tags") || "").trim();
  const tags = rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const fileInput = formData.get("file");

  if (!title || !category) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  let filePath: string | null = null;
  let fileType: string | null = null;

  if (fileInput instanceof File && fileInput.size > 0) {
    const safeName = normalizeFileName(fileInput.name || "resource-file");
    const storagePath = `${user.id}/${Date.now()}-${safeName}`;
    const fileBuffer = Buffer.from(await fileInput.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from("resources").upload(storagePath, fileBuffer, {
      contentType: fileInput.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    filePath = storagePath;
    fileType = fileInput.name.includes(".") ? fileInput.name.split(".").pop() || null : null;
  }

  const { error } = await supabase.from("resources").insert({
    title,
    category,
    notes: notes || null,
    tags: tags.length ? tags : null,
    file_path: filePath,
    file_type: fileType,
    uploaded_by: user.id,
    uploader_name: user.user_metadata?.full_name || user.email,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/resources");
  revalidatePath("/dashboard");
  redirect("/resources");
}

export default function AddResourcePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl">Add Resource</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a file to the private bucket and publish the resource card for members.
        </p>
      </div>

      <form action={addResource} className="rounded-3xl border bg-card p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Title</span>
            <input name="title" required placeholder="Clinical interviewing quick guide" className="rounded-md border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Category</span>
            <input name="category" required placeholder="Assessment" className="rounded-md border bg-background px-3 py-2" />
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Tags</span>
            <input name="tags" placeholder="assessment, ethics, exam prep" className="rounded-md border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">File</span>
            <input name="file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.mp4,.mov" className="rounded-md border bg-background px-3 py-2" />
          </label>
        </div>

        <label className="mt-4 grid gap-2 text-sm">
          <span className="font-medium">Notes</span>
          <textarea name="notes" placeholder="What this file covers and how members should use it" className="min-h-32 rounded-md border bg-background px-3 py-2" />
        </label>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">The file lands in the private resources bucket and the card appears in Resources.</p>
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Publish resource
          </button>
        </div>
      </form>
    </div>
  );
}
