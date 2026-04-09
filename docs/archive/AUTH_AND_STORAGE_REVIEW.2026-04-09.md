# Auth, Membership & Storage Review
_Generated: 2026-04-09_

---

## How the current flow is supposed to work

1. New user visits `/auth/request` → fills in name, email, AHPRA, reason → row inserted into `access_requests`
2. Admin manually reviews `/admin` → approves → manually adds email to `approved_users`
3. Approved user visits `/auth/login` → enters email → receives a **magic link** → clicks link → lands at `/auth/callback` → redirected to `/dashboard`
4. Member layout (`(member)/layout.tsx`) checks `approved_users` on every request and gates access

---

## Issues Found

### Issue 1 — Sign-up page leads nowhere
`/auth/sign-up` lets anyone create a password-based Supabase account. After email verification they have an `auth.users` entry but are NOT in `approved_users`. When they go to `/auth/login` they get sent to `/auth/request-status` showing "Approved: No." There is no path from sign-up to approval. The page creates a false impression that signing up grants access.

**Fix:** Remove `/auth/sign-up` entirely, or replace it with a redirect to `/auth/request`. The magic-link login is your real member auth path.

---

### Issue 2 — Login form redirects to the wrong page
After submitting the magic link form, the code does `router.push("/auth/request-status")`. That page is titled "Request status" — not "Check your email." An already-approved user will be confused.

**Fix:** Either show the confirmation notice inline on the login page (don't redirect), or redirect to a dedicated `/auth/check-email` page.

---

### Issue 3 — Duplicate AHPRA fields in the request form
The request form has two inputs with nearly identical placeholders:
- `ahpra_registration` — "AHPRA registration number (optional)"
- `psy_number` — "AHPRA registration number (PSY0001234567)"

Also, `psy_number` has pattern `PSY\d{10}` which doesn't work in HTML — `\d` is not valid in HTML `pattern`. Should be `PSY[0-9]{10}`.

**Fix:** Consolidate to one field (`psy_number`), label it clearly ("AHPRA PSY number"), fix the pattern to `PSY[0-9]{10}`, and make it optional.

---

### Issue 4 — Silent failure on the request form
If required fields are missing or consent isn't checked, `submitAccessRequest` silently returns with no user feedback:

```typescript
if (!payload.full_name || !payload.email || !payload.reason || !consentGiven) {
  return; // user sees nothing happen
}
```

**Fix:** Use `useFormState` with a returned error object, or add client-side validation before submission so the failure is visible.

---

### Issue 5 — `approved_users` and `access_requests` are disconnected
When an admin approves a request, no code automatically copies the row into `approved_users`. This must be done manually, making approval a multi-step, error-prone process.

**Fix:** The admin "Approve" button should write to both tables atomically (or a Supabase database function/trigger should handle it).

---

### Issue 6 — RLS policies don't enforce member approval at the DB level
RLS policies for resources, sessions, quizzes, and forum content all use:

```sql
using (auth.role() = 'authenticated')
```

This means anyone with a valid Supabase auth token (including unapproved sign-ups) can query those tables via the Supabase REST API directly — the member gate only exists in the Next.js layout, which is bypassed by direct API calls.

Also note: `auth.role() = 'authenticated'` is deprecated. Modern equivalent is `auth.uid() IS NOT NULL`.

**Fix:** Sensitive member tables should join against `approved_users` in the RLS policy, e.g.:
```sql
using (
  auth.uid() IS NOT NULL AND
  exists (
    select 1 from public.approved_users
    where lower(email) = lower(auth.jwt()->>'email')
    and status = 'approved'
  )
)
```

---

### Issue 7 — Admin check re-implemented in three places
The "is this user an admin?" logic is written independently in:
- `lib/admin-access.ts`
- `app/auth/login/page.tsx` (inline)
- `app/(member)/layout.tsx` (inline)

**Fix:** Import and use `getAdminSession()` from `lib/admin-access.ts` everywhere. Delete the inline duplicates.

---

### Issue 8 — Bypass mechanism exposed via NEXT_PUBLIC_
`NEXT_PUBLIC_ALLOW_MEMBER_BYPASS` is readable in the browser JS bundle. Combined with the cookie bypass (`member_bypass=1`), a user who reads the bundle could set that cookie and access the member area without authentication.

**Fix:** Remove the `NEXT_PUBLIC_` variant entirely. Keep bypass logic server-side only (`ALLOW_MEMBER_BYPASS` without the `NEXT_PUBLIC_` prefix).

---

### Issue 9 — Real credentials in `.env.example`
`.env.example` contains what appear to be real Supabase project URL and publishable key values. `NEXT_PUBLIC_` anon keys are technically safe to expose, but committing them to example files reveals your project identity.

**Fix:** Replace with placeholder strings like `https://your-project-ref.supabase.co` and `your-publishable-key`.

---

## DigitalOcean Spaces Setup (GitHub Education Plan)

Your GitHub Education plan includes $200 in DigitalOcean credits. DigitalOcean Spaces is S3-compatible object storage at $5/month (250 GB, 1 TB transfer). Your existing `resources.file_path` column is already set up to store file paths — this just redirects where the files live.

### Step 1 — Claim credits
Go to [education.github.com/pack](https://education.github.com/pack), find DigitalOcean, and redeem. The $200 credit applies to your account.

### Step 2 — Create a Space
In the DigitalOcean dashboard: **Spaces Object Storage → Create Space**
- Region: Sydney (`syd1`) or closest to your users
- Permissions: **Private** (your app serves files, not direct public links)

### Step 3 — Generate access keys
Space settings → **Manage Keys → Generate New Key**
You'll get an Access Key ID and Secret Access Key.

Add to your `.env.local` (never `.env.example`):
```
DO_SPACES_KEY=your-access-key-id
DO_SPACES_SECRET=your-secret-key
DO_SPACES_REGION=syd1
DO_SPACES_BUCKET=your-space-name
DO_SPACES_ENDPOINT=https://syd1.digitaloceanspaces.com
```

### Step 4 — Install the AWS SDK
Spaces is S3-compatible, so you use the AWS SDK:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Step 5 — Create a storage utility
Create `lib/storage.ts`:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
  region: process.env.DO_SPACES_REGION!,
  endpoint: process.env.DO_SPACES_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
  forcePathStyle: false, // required for Spaces
});

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.DO_SPACES_BUCKET!,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: "private",
  }));
  return key; // store this in resources.file_path
}

export async function getPresignedUrl(key: string, expiresIn = 3600) {
  // Returns a time-limited URL — only authenticated members should call this server-side
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: process.env.DO_SPACES_BUCKET!,
    Key: key,
  }), { expiresIn });
}

export async function deleteFile(key: string) {
  await s3.send(new DeleteObjectCommand({
    Bucket: process.env.DO_SPACES_BUCKET!,
    Key: key,
  }));
}
```

### Step 6 — Update your resource upload flow
When uploading a resource file, call `uploadFile()` and store the returned key in `resources.file_path`. When a member requests a download, call `getPresignedUrl()` server-side and return the signed URL. Files stay private; only authenticated members get time-limited access links.

### Step 7 — Clean up Supabase Storage policies
Once files move to Spaces, you can remove the three `storage.objects` policies from `001_npe_schema.sql`:
```sql
-- These can be removed once Spaces is in use:
-- "Authenticated users can read resource objects"
-- "Authenticated users can upload resource objects"
-- "Authenticated users can delete resource objects"
```
Supabase still handles auth and the database. DigitalOcean Spaces handles the files.

---

## Priority order for fixes

1. **Issue 4** (silent form failure) — users can't tell if their request submitted
2. **Issue 1** (sign-up dead end) — actively misleads new users
3. **Issue 6** (RLS doesn't enforce approval) — security gap
4. **Issue 5** (disconnected approval tables) — admin workflow is fragile
5. **Issue 2** (wrong redirect after login) — confusing UX
6. **Issue 3** (duplicate AHPRA fields) — confusing UX + broken validation
7. **Issue 7** (admin check in three places) — maintenance risk
8. **Issue 8** (NEXT_PUBLIC bypass) — security hygiene
9. **Issue 9** (credentials in example file) — hygiene
