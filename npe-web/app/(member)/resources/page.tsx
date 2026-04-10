import { createClient } from "@/lib/supabase/server";
import { ResourceLibraryClient } from "@/components/member/resource-library-client";

type ResourceRow = {
  id: string;
  title: string;
  file_type: string | null;
  category: string;
  domain: string | null;
  modality: string | null;
  population: string | null;
  content_type: string | null;
  source: string | null;
  tags: string[] | null;
  notes: string | null;
  uploader_name: string | null;
  file_path: string | null;
  created_at: string | null;
};

export default async function ResourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: richResources, error: richError } = await supabase
    .from("resources")
    .select("id,title,file_type,category,domain,modality,population,content_type,source,tags,notes,uploader_name,file_path,created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  let resources: ResourceRow[] = (richResources ?? []) as ResourceRow[];
  let loadErrorCode: string | null = null;
  let loadErrorHint: string | null = null;

  if (richError) {
    loadErrorCode = String(richError.code || "read_failed");
    loadErrorHint = String(richError.message || "Could not load resources");

    const { data: fallbackResources, error: fallbackError } = await supabase
      .from("resources")
      .select("id,title,file_type,category,notes,uploader_name,file_path,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!fallbackError && fallbackResources) {
      resources = fallbackResources.map((row) => ({
        id: row.id,
        title: row.title,
        file_type: row.file_type,
        category: row.category,
        domain: null,
        modality: null,
        population: null,
        content_type: null,
        source: null,
        tags: null,
        notes: row.notes,
        uploader_name: row.uploader_name,
        file_path: row.file_path,
        created_at: row.created_at,
      }));
    }
  }

  let progressIds = new Set<string>();

  if (user) {
    const { data: progress } = await supabase
      .from("user_progress")
      .select("resource_id")
      .eq("user_id", user.id);

    progressIds = new Set((progress ?? []).map((row) => row.resource_id));
  }

  const resourcesForClient = resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    file_type: resource.file_type,
    category: resource.category,
    domain: resource.domain,
    modality: resource.modality,
    population: resource.population,
    content_type: resource.content_type,
    source: resource.source,
    tags: resource.tags,
    notes: resource.notes,
    uploader_name: resource.uploader_name,
    hasFile: Boolean(resource.file_path),
    completed: progressIds.has(resource.id),
  }));

  return <ResourceLibraryClient resources={resourcesForClient} loadErrorCode={loadErrorCode} loadErrorHint={loadErrorHint} />;
}
