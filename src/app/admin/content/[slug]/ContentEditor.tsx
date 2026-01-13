"use client";

import { useState } from "react";
import Link from "next/link";
import { updatePageContent } from "../actions";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface ContentEditorProps {
  slug: string;
  initialTitle: string;
  initialContent: string;
  updatedAt: string;
}

export default function ContentEditor({
  slug,
  initialTitle,
  initialContent,
  updatedAt,
}: ContentEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState(updatedAt);

  const isDirty = title !== initialTitle || content !== initialContent;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const result = await updatePageContent(slug, title, content);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setLastSaved(new Date().toISOString());
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    }

    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/content"
            className="text-[rgb(var(--color-accent-primary))] hover:underline text-sm"
          >
            &larr; Back to Content
          </Link>
          <span className="text-[rgb(var(--color-text-muted))] text-sm">
            Last saved:{" "}
            {new Date(lastSaved).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="px-3 py-1.5 text-sm rounded-lg border border-[rgb(var(--color-border-primary))] hover:bg-[rgb(var(--color-bg-secondary))]"
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[rgb(var(--color-accent-primary))] text-white hover:bg-[rgb(var(--color-accent-hover))] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-[rgb(var(--color-error-bg))] text-[rgb(var(--color-error-text))] text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-[rgb(var(--color-success-bg))] text-[rgb(var(--color-success-text))] text-sm">
          Changes saved successfully!
        </div>
      )}

      {/* Editor or Preview */}
      {showPreview ? (
        <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] p-6">
          <h1 className="text-3xl font-bold mb-6">{title}</h1>
          <MarkdownRenderer content={content} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Title Input */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1"
            >
              Page Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))]"
            />
          </div>

          {/* Content Textarea */}
          <div>
            <label
              htmlFor="content"
              className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1"
            >
              Content (Markdown)
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] resize-y"
              placeholder="Enter markdown content..."
            />
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
              Supports markdown: **bold**, *italic*, [links](url), ## headers, - lists
            </p>
          </div>
        </div>
      )}

      {/* View Public Page Link */}
      <div className="text-sm text-[rgb(var(--color-text-muted))]">
        View public page:{" "}
        <Link
          href={`/${slug}`}
          className="text-[rgb(var(--color-accent-primary))] hover:underline"
          target="_blank"
        >
          /{slug}
        </Link>
      </div>
    </div>
  );
}
