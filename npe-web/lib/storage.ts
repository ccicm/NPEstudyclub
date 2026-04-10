import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { SupabaseClient } from "@supabase/supabase-js";

type StorageMode = "supabase" | "do-spaces";

type UploadArgs = {
  supabase: SupabaseClient;
  objectKey: string;
  body: Buffer;
  contentType: string;
};

type UploadFailureCode =
  | "storage_not_ready"
  | "storage_misconfigured"
  | "not_authorized"
  | "upload_failed";

type UploadResult =
  | { ok: true }
  | {
      ok: false;
      code: UploadFailureCode;
    };

type SignedUrlArgs = {
  supabase: SupabaseClient;
  objectKey: string;
  expiresInSeconds: number;
};

type DoSpacesConfig = {
  key: string;
  secret: string;
  region: string;
  bucket: string;
  endpoint: string;
};

function getDoSpacesConfig(): DoSpacesConfig | null {
  const key = process.env.DO_SPACES_KEY;
  const secret = process.env.DO_SPACES_SECRET;
  const region = process.env.DO_SPACES_REGION;
  const bucket = process.env.DO_SPACES_BUCKET;
  const endpoint = process.env.DO_SPACES_ENDPOINT;

  if (!key || !secret || !region || !bucket || !endpoint) {
    return null;
  }

  return { key, secret, region, bucket, endpoint };
}

function getStorageMode(): StorageMode {
  return getDoSpacesConfig() ? "do-spaces" : "supabase";
}

function mapSupabaseError(message: string): UploadFailureCode {
  const lower = message.toLowerCase();

  if (lower.includes("bucket") && lower.includes("not found")) return "storage_not_ready";
  if (lower.includes("row-level security") || lower.includes("permission denied")) return "not_authorized";
  if (lower.includes("invalid api key") || lower.includes("jwt") || lower.includes("unauthorized")) {
    return "storage_misconfigured";
  }

  return "upload_failed";
}

function mapDoSpacesError(error: unknown): UploadFailureCode {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("nosuchbucket") || message.includes("the specified bucket does not exist")) {
    return "storage_not_ready";
  }

  if (
    message.includes("accessdenied") ||
    message.includes("invalidaccesskeyid") ||
    message.includes("signaturedoesnotmatch") ||
    message.includes("credentials")
  ) {
    return "storage_misconfigured";
  }

  return "upload_failed";
}

function createDoSpacesClient(config: DoSpacesConfig) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.key,
      secretAccessKey: config.secret,
    },
  });
}

export async function uploadResourceObject({
  supabase,
  objectKey,
  body,
  contentType,
}: UploadArgs): Promise<UploadResult> {
  const storageMode = getStorageMode();

  if (storageMode === "do-spaces") {
    const config = getDoSpacesConfig();

    if (!config) {
      return { ok: false, code: "storage_misconfigured" };
    }

    const client = createDoSpacesClient(config);

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: objectKey,
          Body: body,
          ContentType: contentType,
        }),
      );

      return { ok: true };
    } catch (error) {
      return { ok: false, code: mapDoSpacesError(error) };
    }
  }

  const { error } = await supabase.storage.from("resources").upload(objectKey, body, {
    contentType,
    upsert: false,
  });

  if (!error) {
    return { ok: true };
  }

  return { ok: false, code: mapSupabaseError(error.message || "") };
}

export async function createResourceSignedUrl({
  supabase,
  objectKey,
  expiresInSeconds,
}: SignedUrlArgs): Promise<string | null> {
  const storageMode = getStorageMode();

  if (storageMode === "do-spaces") {
    const config = getDoSpacesConfig();

    if (!config) {
      return null;
    }

    const client = createDoSpacesClient(config);

    try {
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
      });

      return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    } catch {
      return null;
    }
  }

  const { data } = await supabase.storage.from("resources").createSignedUrl(objectKey, expiresInSeconds);
  return data?.signedUrl ?? null;
}
