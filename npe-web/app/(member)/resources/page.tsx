import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ResourcesPage() {
  const supabase = await createClient();
  const { data: resources } = await supabase
    .from("resources")
    .select("id,title,file_type,category,tags,notes,uploader_name")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Resources</h1>
        <Link className="text-sm text-primary underline" href="/add">
          Upload new resource
        </Link>
      </div>

      {!resources?.length ? (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          No resources match your search yet. Upload one to get started.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resources.map((r) => (
            <article key={r.id} className="rounded-2xl border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {r.file_type || "file"}
              </p>
              <h2 className="mt-2 text-xl">{r.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{r.category}</p>
              {r.notes ? <p className="mt-3 text-sm text-muted-foreground">{r.notes}</p> : null}
              {r.tags?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.tags.slice(0, 3).map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded-full bg-accent px-2 py-1 text-xs text-accent-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-4 text-xs text-muted-foreground">Uploaded by {r.uploader_name || "Member"}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
