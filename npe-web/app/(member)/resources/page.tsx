import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function ResourcesPage() {
  const supabase = await createClient();
  const { data: resources } = await supabase
    .from("resources")
    .select("id,title,file_type,category,tags,notes,uploader_name,file_path,created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  const resourcesWithLinks = await Promise.all(
    (resources ?? []).map(async (resource) => {
      if (!resource.file_path) {
        return { ...resource, signedUrl: null };
      }

      const { data } = await supabase.storage.from("resources").createSignedUrl(resource.file_path, 60 * 60);
      return { ...resource, signedUrl: data?.signedUrl ?? null };
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Resources</h1>
        <Link className="text-sm text-primary underline" href="/add">
          Upload new resource
        </Link>
      </div>

      {!resourcesWithLinks.length ? (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          No resources match your search yet. Upload one to get started.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resourcesWithLinks.map((r) => (
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
              <div className="mt-4 flex flex-wrap gap-2">
                {r.signedUrl ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={r.signedUrl} target="_blank" rel="noreferrer">
                      Open file
                    </a>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="secondary">
                  <Link href="/add">Add another</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
