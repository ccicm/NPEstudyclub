"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getResourceDownloadUrlAction, toggleResourceComplete } from "@/app/(member)/resources/actions";
import { Button } from "@/components/ui/button";
import {
  CLINICAL_MODALITIES,
  CLINICAL_POPULATIONS,
  CONTENT_TYPES,
  EXAM_PREP_DOMAINS,
  RESOURCE_CATEGORIES,
} from "@/lib/resource-options";

type Resource = {
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
  hasFile: boolean;
  completed: boolean;
};

type Props = {
  resources: Resource[];
  loadErrorCode?: string | null;
  loadErrorHint?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function fileBadgeColor(fileType: string | null) {
  const ext = normalize(fileType);
  if (ext === "pdf") return "bg-red-100 text-red-700";
  if (ext === "docx" || ext === "doc") return "bg-blue-100 text-blue-700";
  if (ext === "ppt" || ext === "pptx") return "bg-orange-100 text-orange-700";
  if (ext === "xls" || ext === "xlsx") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-700";
}

export function ResourceLibraryClient({ resources, loadErrorCode = null }: Props) {
  const searchParams = useSearchParams();
  const selectedResourceId = searchParams.get("id");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<(typeof RESOURCE_CATEGORIES)[number]>("All");
  const [domainFilter, setDomainFilter] = useState("");
  const [modalityFilter, setModalityFilter] = useState("");
  const [populationFilter, setPopulationFilter] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState("");
  const debounceRef = useRef<number | null>(null);
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>(
    Object.fromEntries(resources.map((resource) => [resource.id, resource.completed])),
  );
  const [isPending, startTransition] = useTransition();
  const [downloadPendingId, setDownloadPendingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const loadErrorMessage = loadErrorCode
    ? "Some resource details could not load. The library is showing available content where possible. Refresh to try again."
    : null;

  useEffect(() => {
    if (!selectedResourceId) {
      return;
    }

    const selected = resources.find((resource) => resource.id === selectedResourceId);
    if (!selected) {
      return;
    }

    if (selected.category === "Exam Prep" || selected.category === "Clinical Practice") {
      setActiveCategory(selected.category);
    }
  }, [selectedResourceId, resources]);

  const debouncedSetQuery = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      setSearchQuery(value.trim().toLowerCase());
    }, 200);
  };

  const filtered = useMemo(() => {
    return resources.filter((resource) => {
      const inCategory = activeCategory === "All" || normalize(resource.category) === normalize(activeCategory);

      if (!inCategory) return false;

      if (activeCategory === "Exam Prep" && domainFilter && normalize(resource.domain) !== normalize(domainFilter)) {
        return false;
      }

      if (activeCategory === "Clinical Practice") {
        if (modalityFilter && normalize(resource.modality) !== normalize(modalityFilter)) {
          return false;
        }
        if (populationFilter && normalize(resource.population) !== normalize(populationFilter)) {
          return false;
        }
      }

      if (contentTypeFilter && normalize(resource.content_type) !== normalize(contentTypeFilter)) {
        return false;
      }

      if (!searchQuery) return true;

      const searchable = [
        resource.title,
        resource.notes,
        resource.domain,
        resource.file_type,
        resource.category,
        resource.uploader_name,
        resource.modality,
        resource.population,
        resource.content_type,
        resource.source,
        ...(resource.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(searchQuery);
    });
  }, [
    activeCategory,
    contentTypeFilter,
    domainFilter,
    modalityFilter,
    populationFilter,
    resources,
    searchQuery,
  ]);

  useEffect(() => {
    if (!selectedResourceId) {
      return;
    }

    const target = document.getElementById(`resource-${selectedResourceId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedResourceId, filtered.length]);

  const clearFilters = () => {
    setDomainFilter("");
    setModalityFilter("");
    setPopulationFilter("");
    setContentTypeFilter("");
    setSearchInput("");
    setSearchQuery("");
  };

  const applyTagFilter = (tag: string) => {
    const loweredTag = normalize(tag);
    const isDomain = EXAM_PREP_DOMAINS.some((value) => normalize(value) === loweredTag);
    const isModality = CLINICAL_MODALITIES.some((value) => normalize(value) === loweredTag);
    const isPopulation = CLINICAL_POPULATIONS.some((value) => normalize(value) === loweredTag);
    const isType = CONTENT_TYPES.some((value) => normalize(value) === loweredTag);

    if (isDomain) {
      setActiveCategory("Exam Prep");
      setDomainFilter(tag);
    } else if (isModality) {
      setActiveCategory("Clinical Practice");
      setModalityFilter(tag);
    } else if (isPopulation) {
      setActiveCategory("Clinical Practice");
      setPopulationFilter(tag);
    } else if (isType) {
      setContentTypeFilter(tag);
    } else {
      setSearchInput(tag);
      setSearchQuery(loweredTag);
    }
  };

  const toggleComplete = (resourceId: string) => {
    const current = completionMap[resourceId] ?? false;
    setCompletionMap((previous) => ({ ...previous, [resourceId]: !current }));

    startTransition(async () => {
      try {
        await toggleResourceComplete(resourceId, current);
      } catch {
        setCompletionMap((previous) => ({ ...previous, [resourceId]: current }));
      }
    });
  };

  const openFile = async (resourceId: string) => {
    setDownloadError(null);
    setDownloadPendingId(resourceId);

    try {
      const signedUrl = await getResourceDownloadUrlAction(resourceId);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      setDownloadError("Could not view this file. Please refresh and try again.");
    } finally {
      setDownloadPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {loadErrorCode ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{loadErrorMessage}</p>
        </div>
      ) : null}

      {downloadError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {downloadError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Resources</h1>
        <Button asChild>
          <Link href="/add">+ Add Resource</Link>
        </Button>
      </div>

      <input
        value={searchInput}
        onChange={(event) => debouncedSetQuery(event.target.value)}
        placeholder="Search resources…"
        className="h-10 w-full rounded-md border bg-card px-3 text-sm"
      />

      <div className="flex flex-wrap gap-2">
        {RESOURCE_CATEGORIES.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveCategory(tab);
              setDomainFilter("");
              setModalityFilter("");
              setPopulationFilter("");
            }}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              activeCategory === tab ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <select
            value={contentTypeFilter}
            onChange={(event) => setContentTypeFilter(event.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Content Type</option>
            {CONTENT_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          {activeCategory === "Exam Prep" ? (
            <select
              value={domainFilter}
              onChange={(event) => setDomainFilter(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Domain</option>
              {EXAM_PREP_DOMAINS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : null}

          {activeCategory === "Clinical Practice" ? (
            <>
              <select
                value={modalityFilter}
                onChange={(event) => setModalityFilter(event.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Modality</option>
                {CLINICAL_MODALITIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={populationFilter}
                onChange={(event) => setPopulationFilter(event.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Population</option>
                {CLINICAL_POPULATIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} resources</p>
        <button type="button" onClick={clearFilters} className="text-sm text-primary underline">
          Clear filters
        </button>
      </div>

      {!filtered.length ? (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          {resources.length === 0 ? (
            <>
              Nothing has been uploaded yet. <Link href="/add" className="underline">Add a resource</Link> to get started.
            </>
          ) : (
            <>No resources match. Try clearing a filter.</>
          )}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((resource) => {
            const done = completionMap[resource.id] ?? false;
            const isSelected = selectedResourceId === resource.id;
            return (
              <article
                key={resource.id}
                id={`resource-${resource.id}`}
                className={`rounded-3xl border bg-card p-5 ${isSelected ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${fileBadgeColor(resource.file_type)}`}>
                    {(resource.file_type ?? "file").toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleComplete(resource.id)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    disabled={isPending}
                    aria-pressed={done}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                    Complete
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      normalize(resource.category) === "exam prep"
                        ? "bg-teal-100 text-teal-800"
                        : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    {resource.category}
                  </span>
                  {resource.content_type ? (
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {resource.content_type}
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-3 text-xl leading-tight">{resource.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{resource.domain || resource.modality || "General"}</p>

                {resource.tags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {resource.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => applyTagFilter(tag)}
                        className="rounded-full border bg-background px-2 py-1 text-xs"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}

                {resource.notes ? (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{resource.notes}</p>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-2">
                  {resource.hasFile ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openFile(resource.id)}
                      disabled={downloadPendingId === resource.id}
                    >
                      {downloadPendingId === resource.id ? "Opening..." : "View resource"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">No file attached</span>
                  )}
                  <p className="text-xs text-muted-foreground">Uploaded by {resource.uploader_name || "Member"}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
