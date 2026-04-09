# Resource Storage Setup — Tomorrow Checklist

This checklist exists to stop resource storage setup from being missed again.

## Goal

Make member uploads work reliably with either:

- Supabase Storage using a private `resources` bucket, or
- DigitalOcean Spaces with signed URLs and Supabase metadata.

## Decide storage mode first

Pick one mode for tomorrow's pass and validate it end-to-end before touching polish work.

1. `supabase-bucket` mode: fastest path to restore uploads.
2. `digitalocean-spaces` mode: preferred long-term path if env and keys are ready.

## Option A — Supabase bucket (fastest unblock)

1. Confirm private bucket `resources` exists.
2. Confirm app has upload/read/delete policies required by current upload action.
3. Upload a test file from `/add`.
4. Confirm file metadata row is created in `resources` table.
5. Confirm member can open/download file from `/resources`.

## Option B — DigitalOcean Spaces

1. Confirm env vars are set in deployment and local test env:
   - `DO_SPACES_KEY`
   - `DO_SPACES_SECRET`
   - `DO_SPACES_REGION`
   - `DO_SPACES_BUCKET`
   - `DO_SPACES_ENDPOINT`
2. Confirm upload path writes object key into `resources.file_path`.
3. Confirm signed URL generation works server-side for member downloads.
4. Upload a test file from `/add` and verify download in `/resources`.
5. Verify failure handling shows actionable message when keys/bucket are misconfigured.

## Required verification notes

Capture the following in tomorrow's agent summary:

1. Which storage mode was used.
2. Exact env/config changes made.
3. Result of one successful upload + download test.
4. Any remaining blocker with clear next action.
