# Implementation Brief: Bulk Import Flow + Priority Fixes
**Project:** NPE Study Club — `npe-web` (Next.js 16 / Supabase / DigitalOcean Spaces)  
**Prepared:** 2026-04-10  
**For:** Implementation agent

---

## Context

The resource library currently has no draft/staging concept — every row inserted into `public.resources` is immediately visible to all approved members. The site owner needs to bulk-import 100+ files without manually completing metadata for each one upfront. This brief covers the prerequisite migration, the bulk importer script, and three additional priority fixes identified during a codebase review.

**Repo root:** `/sessions/nice-hopeful-knuth/mnt/NPEstudyclub/npe-web/`  
**Env file (local, not committed):** `npe-web/.env.local` — contains all live credentials  
**Migration folder:** `npe-web/supabase/` — numbered SQL files, applied manually via Supabase dashboard

---

## Task 1 — Migration 014: Status Column + Revised RLS

**File to create:** `npe-web/supabase/014_resource_status_and_bulk_import.sql`

**What it does:**
- Adds a `status` column (`draft` | `pending_metadata` | `published`) defaulting to `'draft'`
- Marks all existing live rows as `'published'` so nothing disappears
- Updates the member SELECT policy so only `published` rows are visible to regular members
- Adds an admin SELECT policy (by email) so the site owner can see all rows including drafts
- Adds an admin UPDATE policy so the owner can edit any row's metadata from the Supabase dashboard

**SQL:**

```sql
-- 014_resource_status_and_bulk_import.sql
-- Adds draft/publish staging to resources table.
-- Safe to run multiple times.

-- 1. Add status column with safe default
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'pending_metadata', 'published'));

-- 2. Preserve all existing rows — they are already live
UPDATE public.resources
  SET status = 'published'
  WHERE status = 'draft';

-- 3. Drop the existing blanket SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read resources" ON public.resources;
DROP POLICY IF EXISTS "Members can read published resources" ON public.resources;
DROP POLICY IF EXISTS "Admin can read all resources" ON public.resources;
DROP POLICY IF EXISTS "Admin can update resources" ON public.resources;

-- 4. Members only see published rows
CREATE POLICY "Members can read published resources"
ON public.resources FOR SELECT
TO authenticated
USING (public.is_approved_member() AND status = 'published');

-- 5. Admin sees all rows (including drafts)
-- Replace email if ownership changes
CREATE POLICY "Admin can read all resources"
ON public.resources FOR SELECT
TO authenticated
USING (lower(auth.jwt()->>'email') = lower('connorconkeymorrison@gmail.com'));

-- 6. Admin can update any row (fill in metadata, flip status to published)
CREATE POLICY "Admin can update resources"
ON public.resources FOR UPDATE
TO authenticated
USING (lower(auth.jwt()->>'email') = lower('connorconkeymorrison@gmail.com'))
WITH CHECK (lower(auth.jwt()->>'email') = lower('connorconkeymorrison@gmail.com'));
```

**Apply this migration in the Supabase dashboard (SQL Editor) before running any other task.**

---

## Task 2 — Bulk Importer Script

**File to create:** `npe-web/scripts/bulk-import.mjs`

**What it does:**
- Accepts a local directory path as a CLI argument
- Uploads every file in that directory to DO Spaces under the `bulk-import/` prefix
- Scans the bucket for all objects under `bulk-import/`
- For each object, inserts a `draft` row into `public.resources` if no row already exists for that `file_path` (idempotent — safe to re-run)
- Derives `title` from the filename (strips timestamp prefix, extension, and replaces separators with spaces)
- Sets `category = 'Uncategorised'` as a placeholder (owner fills this in later)
- Sets `status = 'draft'` — row will be invisible to members until published

**Dependencies:** Uses `@aws-sdk/client-s3` and `@supabase/supabase-js`, both already installed in `package.json`.

**Requires these env vars** (all present in `.env.local`):
- `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `DO_SPACES_REGION`, `DO_SPACES_BUCKET`, `DO_SPACES_ENDPOINT`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — check `.env.local`; it may be named `SUPABASE_SERVICE_KEY`. Use whatever key is present.
- `ADMIN_USER_ID` — the site owner's UUID from `auth.users`. Retrieve from Supabase dashboard → Authentication → Users.

**Script:**

```js
// npe-web/scripts/bulk-import.mjs
// Usage: node --env-file=.env.local scripts/bulk-import.mjs /absolute/path/to/files

import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const {
  DO_SPACES_KEY,
  DO_SPACES_SECRET,
  DO_SPACES_REGION,
  DO_SPACES_BUCKET,
  DO_SPACES_ENDPOINT,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_SERVICE_KEY,
  ADMIN_USER_ID,
} = process.env;

const serviceKey = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_SERVICE_KEY;

if (!DO_SPACES_KEY || !serviceKey || !ADMIN_USER_ID) {
  console.error('Missing required env vars. Check DO_SPACES_KEY, SUPABASE_SERVICE_ROLE_KEY, and ADMIN_USER_ID.');
  process.exit(1);
}

const LOCAL_DIR = process.argv[2];
if (!LOCAL_DIR || !fs.existsSync(LOCAL_DIR)) {
  console.error('Provide a valid directory path as the first argument.');
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: DO_SPACES_ENDPOINT,
  region: DO_SPACES_REGION,
  credentials: { accessKeyId: DO_SPACES_KEY, secretAccessKey: DO_SPACES_SECRET },
  forcePathStyle: false,
});

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, serviceKey);

function deriveTitle(filename) {
  return filename
    .replace(/^\d{13}-/, '')       // strip leading timestamp if present
    .replace(/\.[^/.]+$/, '')      // strip extension
    .replace(/[_-]+/g, ' ')        // underscores/hyphens → spaces
    .replace(/\s+/g, ' ')
    .trim();
}

async function uploadFiles(dir) {
  const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
  console.log(`\nUploading ${files.length} file(s) to DO Spaces...\n`);
  const uploaded = [];

  for (const filename of files) {
    const filePath = path.join(dir, filename);
    if (!fs.statSync(filePath).isFile()) continue;

    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `bulk-import/${Date.now()}-${safeFilename}`;
    const body = fs.readFileSync(filePath);

    try {
      await s3.send(new PutObjectCommand({
        Bucket: DO_SPACES_BUCKET,
        Key: key,
        Body: body,
        ACL: 'private',
      }));
      console.log(`  ✓ Uploaded: ${key}`);
      uploaded.push(key);
    } catch (err) {
      console.error(`  ✗ Failed to upload ${filename}:`, err.message);
    }
  }

  return uploaded;
}

async function syncDraftRows() {
  console.log('\nScanning bucket and syncing draft rows...\n');

  let allObjects = [];
  let continuationToken;

  do {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: DO_SPACES_BUCKET,
      Prefix: 'bulk-import/',
      ContinuationToken: continuationToken,
    }));
    allObjects = allObjects.concat(result.Contents ?? []);
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`Found ${allObjects.length} object(s) under bulk-import/\n`);

  let inserted = 0, skipped = 0, failed = 0;

  for (const obj of allObjects) {
    const key = obj.Key;
    const filename = path.basename(key);
    const ext = path.extname(filename).replace('.', '').toLowerCase() || null;
    const title = deriveTitle(filename);
    const file_path = `${DO_SPACES_BUCKET}/${key}`;

    // Idempotency check
    const { data: existing } = await supabase
      .from('resources')
      .select('id')
      .eq('file_path', file_path)
      .maybeSingle();

    if (existing) {
      console.log(`  → Skipped (already exists): ${title}`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from('resources').insert({
      title,
      category: 'Uncategorised',
      file_path,
      file_type: ext,
      uploaded_by: ADMIN_USER_ID,
      uploader_name: 'Connor Morrison',
      status: 'draft',
    });

    if (error) {
      console.error(`  ✗ Failed: ${title} —`, error.message);
      failed++;
    } else {
      console.log(`  ✓ Draft created: ${title}`);
      inserted++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted} | Skipped: ${skipped} | Failed: ${failed}`);
}

await uploadFiles(LOCAL_DIR);
await syncDraftRows();
```

**To run** (from `npe-web/` directory):
```bash
node --env-file=.env.local scripts/bulk-import.mjs /path/to/your/files
```

**Note:** `category = 'Uncategorised'` requires that the DB allows this value. Before running the script, either:  
- (a) Update the `category` CHECK constraint in Supabase to allow `'Uncategorised'`, or  
- (b) Temporarily set a real category value in the script (e.g., `'Exam Prep'`) and correct it later

Option (a) is cleaner. Run this in Supabase SQL Editor after migration 014:
```sql
ALTER TABLE public.resources 
  DROP CONSTRAINT IF EXISTS resources_category_check;
-- No constraint currently exists on category — it's a free-text field, so no change needed.
-- If a constraint does exist, replace with:
-- ALTER TABLE public.resources ADD CONSTRAINT resources_category_check 
--   CHECK (status = 'draft' OR category IN ('Exam Prep', 'Clinical Practice'));
```

(Check the current constraints in Supabase: Table Editor → resources → Constraints tab.)

---

## Task 3 — Fix the LIMIT 200 on Resources Page

**File:** `npe-web/app/(member)/resources/page.tsx`  
**Line:** ~31

The current query silently drops resources beyond 200. With 100+ files being imported, this will be hit soon. As a fast patch, raise the limit to 1000. Proper server-side pagination can follow later.

**Change:**
```diff
- .limit(200);
+ .limit(1000);
```

Also add `status` filtering once migration 014 is applied, so only published rows load for members:
```diff
  .order("created_at", { ascending: false })
+ .eq("status", "published")
  .limit(1000);
```

---

## Task 4 — Add UPDATE Policy for Own Resources (Non-Admin Users)

Currently users can insert and delete their own resources but cannot edit them. Add an UPDATE policy so users can correct metadata on their own uploads.

**Add to migration 014** (or create `015_resource_update_policy.sql`):

```sql
DROP POLICY IF EXISTS "Users can update own resources" ON public.resources;

CREATE POLICY "Users can update own resources"
ON public.resources FOR UPDATE
TO authenticated
USING (auth.uid() = uploaded_by AND public.is_approved_member())
WITH CHECK (auth.uid() = uploaded_by AND public.is_approved_member());
```

An edit form in the UI is out of scope for this brief — the policy just unblocks it when ready.

---

## Task 5 — Fix Signed URL Expiry

**File:** `npe-web/lib/storage.ts`  
Search for the signed URL generation. Current expiry is 120 seconds, which is too short for large files on slow connections.

**Change:** Find the `ExpiresIn` value (or equivalent) and increase to `3600` (1 hour).

---

## Verification Checklist (complete before closing)

- [ ] Migration 014 applied in Supabase — confirm `status` column exists in `resources` table
- [ ] Existing resources still visible to members on `/resources` page (status = 'published')
- [ ] Bulk importer script runs without error on a small test batch (2–3 files)
- [ ] Draft rows do NOT appear on `/resources` page when logged in as a regular member
- [ ] Draft rows DO appear in Supabase Table Editor
- [ ] Admin user CAN see draft rows when browsing `/resources` (if admin UI supports it) or via Supabase
- [ ] LIMIT on resources page raised — confirm 1000 rows can load
- [ ] Signed URL expiry confirmed updated in `lib/storage.ts`

---

## Out of Scope for This Brief (Future Work)

- Admin UI at `/admin/resources` for inline metadata editing and bulk publish
- Server-side pagination on the resources page
- Automated tag regeneration when metadata is updated (requires DB trigger)
- Migrate from manual SQL migrations to `supabase db push` via Supabase CLI
