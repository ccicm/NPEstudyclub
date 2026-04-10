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

function normalizeEndpoint(endpoint: string, bucket: string) {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    return trimmed;
  }

  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";

    const bucketPrefix = `${bucket.toLowerCase()}.`;
    if (parsed.hostname.toLowerCase().startsWith(bucketPrefix)) {
      parsed.hostname = parsed.hostname.slice(bucketPrefix.length);
    }

    return parsed.origin;
  } catch {
    return withProtocol;
  }
}

function getDoSpacesConfig(): DoSpacesConfig | null {
  const key = process.env.DO_SPACES_KEY;
  const secret = process.env.DO_SPACES_SECRET;
  const region = process.env.DO_SPACES_REGION;
  const bucket = process.env.DO_SPACES_BUCKET;
  const endpoint = process.env.DO_SPACES_ENDPOINT;

  if (!key || !secret || !region || !bucket || !endpoint) {
    return null;
  }

  return { key, secret, region, bucket, endpoint: normalizeEndpoint(endpoint, bucket) };
}

function hasAnyDoSpacesEnv() {
  return Boolean(
    process.env.DO_SPACES_KEY ||
      process.env.DO_SPACES_SECRET ||
      process.env.DO_SPACES_REGION ||
      process.env.DO_SPACES_BUCKET ||
      process.env.DO_SPACES_ENDPOINT,
  );
}

function getStorageMode(): StorageMode {
  const configuredMode = (process.env.RESOURCE_STORAGE_MODE || "").trim().toLowerCase();

  if (configuredMode === "do-spaces") {
    return "do-spaces";
  }

  if (configuredMode === "supabase") {
    return "supabase";
  }

  if (hasAnyDoSpacesEnv()) {
    return "do-spaces";
  }

  return "supabase";
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
  const maybeError = error as {
    message?: string;
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const message = String(maybeError?.message || "").toLowerCase();
  const name = String(maybeError?.name || "").toLowerCase();
  const status = Number(maybeError?.$metadata?.httpStatusCode || 0);

  if (
    name.includes("nosuchbucket") ||
    message.includes("nosuchbucket") ||
    message.includes("the specified bucket does not exist") ||
    status === 404
  ) {
    return "storage_not_ready";
  }

  if (
    message.includes("accessdenied") ||
    message.includes("invalidaccesskeyid") ||
    message.includes("signaturedoesnotmatch") ||
    message.includes("credentials") ||
    message.includes("unknown endpoint") ||
    message.includes("authorizationheadermalformed") ||
    message.includes("could not load credentials") ||
    message.includes("getaddrinfo") ||
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("unknownendpoint") ||
    status === 401 ||
    status === 403
  ) {
    return "storage_misconfigured";
  }

  if (status >= 400 && status < 500) {
    return "storage_misconfigured";
  }

  return "upload_failed";
}

function createDoSpacesClient(config: DoSpacesConfig) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
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
