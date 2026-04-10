import { createClient } from "@/lib/supabase/server";
import { createResourceSignedUrl } from "@/lib/storage";
import { ResourceLibraryClient } from "@/components/member/resource-library-client";

export default async function ResourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: resources } = await supabase
    .from("resources")
    .select("id,title,file_type,category,domain,modality,population,content_type,source,tags,notes,uploader_name,file_path,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  let progressIds = new Set<string>();

  if (user) {
    const { data: progress } = await supabase
      .from("user_progress")
      .select("resource_id")
      .eq("user_id", user.id);

    progressIds = new Set((progress ?? []).map((row) => row.resource_id));
  }

  const resourcesWithLinks = await Promise.all(
    (resources ?? []).map(async (resource) => {
      if (!resource.file_path) {
        return { ...resource, signedUrl: null, completed: progressIds.has(resource.id) };
      }

      const signedUrl = await createResourceSignedUrl({
        supabase,
        objectKey: resource.file_path,
        expiresInSeconds: 60 * 60,
      });
      return {
        ...resource,
        signedUrl,
        completed: progressIds.has(resource.id),
      };
    }),
  );

  return <ResourceLibraryClient resources={resourcesWithLinks} />;
}
