"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import {
  CLINICAL_MODALITIES,
  CLINICAL_POPULATIONS,
  CONTENT_TYPES,
  EXAM_PREP_DOMAINS,
} from "@/lib/resource-options";

type Props = {
  action: (formData: FormData) => Promise<void>;
  uploaded: boolean;
  errorCode: string | null;
};

type Category = "Exam Prep" | "Clinical Practice" | "";

function SelectWithOther({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const isOther = value === "Other";

  return (
    <div className="grid gap-2 text-sm">
      <label htmlFor={name} className="font-medium">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border bg-background px-3"
      >
        <option value="">Select {label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {isOther ? (
        <input
          name={`${name}_other`}
          placeholder={`Specify ${label.toLowerCase()}`}
          className="h-10 rounded-md border bg-background px-3"
          required
        />
      ) : null}
    </div>
  );
}

export function AddResourceForm({ action, uploaded, errorCode }: Props) {
  const [category, setCategory] = useState<Category>("");
  const [domain, setDomain] = useState("");
  const [modality, setModality] = useState("");
  const [population, setPopulation] = useState("");
  const [contentType, setContentType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const canSubmit = useMemo(() => Boolean(category && file), [category, file]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl">Add Resource</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload material for the study library with structured metadata for better filtering.
        </p>
      </div>

      {uploaded ? (
        <div className="rounded-2xl border border-primary/30 bg-accent p-4 text-sm">
          Resource uploaded. It will appear in the library shortly.
          <div className="mt-2 flex gap-3">
            <Link href="/add" className="underline">
              Upload another
            </Link>
            <Link href="/resources" className="underline">
              View in Resources
            </Link>
          </div>
        </div>
      ) : null}

      {errorCode ? (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {errorCode === "missing_required"
            ? "Please complete title, category, and file before uploading."
            : errorCode === "storage_not_ready"
              ? "Storage bucket is not ready. Create a private 'resources' bucket in Supabase or configure external storage first."
              : errorCode === "storage_misconfigured"
                ? "Storage is configured incorrectly. For DigitalOcean, confirm region, key/secret, bucket, and endpoint format (e.g. nyc3.digitaloceanspaces.com)."
              : errorCode === "schema_not_ready"
                ? "Resource tables are not ready in Supabase. Run migrations 001, 002, and 003."
                : errorCode === "not_authorized"
                  ? "Your account does not currently have permission to upload resources. Confirm your approved member status."
                  : errorCode === "save_failed"
                    ? "File upload completed but resource metadata could not be saved. Confirm your account is approved and database policies are active."
                  : "Upload failed. If using DigitalOcean Spaces, check endpoint/region/key/bucket values and retry."}
        </p>
      ) : null}

      <form action={action} className="rounded-3xl border bg-card p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Title *</span>
            <input
              name="title"
              required
              placeholder="NPE formulation framework"
              className="h-10 rounded-md border bg-background px-3"
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium">Category *</span>
            <select
              name="category"
              required
              value={category}
              onChange={(event) => {
                const nextCategory = event.target.value as Category;
                setCategory(nextCategory);
                setDomain("");
                setModality("");
                setPopulation("");
              }}
              className="h-10 rounded-md border bg-background px-3"
            >
              <option value="">Select category</option>
              <option value="Exam Prep">Exam Prep</option>
              <option value="Clinical Practice">Clinical Practice</option>
            </select>
          </label>
        </div>

        {category === "Exam Prep" ? (
          <div className="mt-4 grid gap-4 rounded-xl border bg-muted/30 p-4 md:grid-cols-2">
            <SelectWithOther
              name="domain"
              label="Domain / Subtopic"
              options={EXAM_PREP_DOMAINS}
              value={domain}
              onChange={setDomain}
            />
            <SelectWithOther
              name="content_type"
              label="Content Type"
              options={CONTENT_TYPES}
              value={contentType}
              onChange={setContentType}
            />
            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium">Source</span>
              <input name="source" placeholder="APS, textbook, own notes" className="h-10 rounded-md border bg-background px-3" />
            </label>
          </div>
        ) : null}

        {category === "Clinical Practice" ? (
          <div className="mt-4 grid gap-4 rounded-xl border bg-muted/30 p-4 md:grid-cols-2">
            <SelectWithOther
              name="modality"
              label="Modality"
              options={CLINICAL_MODALITIES}
              value={modality}
              onChange={setModality}
            />
            <SelectWithOther
              name="population"
              label="Population"
              options={CLINICAL_POPULATIONS}
              value={population}
              onChange={setPopulation}
            />
            <SelectWithOther
              name="content_type"
              label="Content Type"
              options={CONTENT_TYPES}
              value={contentType}
              onChange={setContentType}
            />
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Source</span>
              <input name="source" placeholder="Guideline, textbook, protocol" className="h-10 rounded-md border bg-background px-3" />
            </label>
          </div>
        ) : null}

        <label className="mt-4 grid gap-2 text-sm">
          <span className="font-medium">Notes / description</span>
          <textarea
            name="notes"
            placeholder="What this resource covers"
            className="min-h-28 rounded-md border bg-background px-3 py-2"
          />
        </label>

        <div className="mt-4 rounded-2xl border border-dashed bg-muted/20 p-5">
          <label htmlFor="resource-file" className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">File upload *</span>
            <span className="text-xs text-muted-foreground">Drag and drop is supported by your browser, or click to browse.</span>
            {file ? (
              <span className="rounded-full bg-accent px-3 py-1 text-xs">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            ) : null}
          </label>
          <input
            id="resource-file"
            name="file"
            type="file"
            required
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
          />
        </div>

        <div className="mt-6 flex items-center justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upload resource
          </button>
        </div>
      </form>
    </div>
  );
}
