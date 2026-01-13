"use client";

import { useState } from "react";
import Link from "next/link";
import type { FAQItem } from "@/lib/types";
import {
  addFAQItem,
  updateFAQItem,
  deleteFAQItem,
  reorderFAQItems,
} from "../actions";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface FAQEditorProps {
  initialItems: FAQItem[];
}

export default function FAQEditor({ initialItems }: FAQEditorProps) {
  const [items, setItems] = useState<FAQItem[]>(initialItems);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    setSaving(true);
    setError(null);

    const result = await addFAQItem(newQuestion.trim(), newAnswer.trim());

    if (result.error) {
      setError(result.error);
    } else if (result.item) {
      setItems([...items, result.item]);
      setNewQuestion("");
      setNewAnswer("");
      setShowAddForm(false);
    }

    setSaving(false);
  }

  async function handleUpdate(id: string) {
    if (!editQuestion.trim() || !editAnswer.trim()) return;

    setSaving(true);
    setError(null);

    const result = await updateFAQItem(id, editQuestion.trim(), editAnswer.trim());

    if (result.error) {
      setError(result.error);
    } else {
      setItems(
        items.map((item) =>
          item.id === id
            ? { ...item, question: editQuestion.trim(), answer: editAnswer.trim() }
            : item
        )
      );
      setEditingId(null);
    }

    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this FAQ item?")) return;

    setSaving(true);
    setError(null);

    const result = await deleteFAQItem(id);

    if (result.error) {
      setError(result.error);
    } else {
      setItems(items.filter((item) => item.id !== id));
    }

    setSaving(false);
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;

    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];

    setSaving(true);
    setError(null);

    const result = await reorderFAQItems(newItems.map((item) => item.id));

    if (result.error) {
      setError(result.error);
    } else {
      setItems(newItems);
    }

    setSaving(false);
  }

  async function handleMoveDown(index: number) {
    if (index === items.length - 1) return;

    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];

    setSaving(true);
    setError(null);

    const result = await reorderFAQItems(newItems.map((item) => item.id));

    if (result.error) {
      setError(result.error);
    } else {
      setItems(newItems);
    }

    setSaving(false);
  }

  function startEditing(item: FAQItem) {
    setEditingId(item.id);
    setEditQuestion(item.question);
    setEditAnswer(item.answer);
    setExpandedId(item.id);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditQuestion("");
    setEditAnswer("");
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/content"
          className="text-[rgb(var(--color-accent-primary))] hover:underline text-sm"
        >
          &larr; Back to Content
        </Link>
        <Link
          href="/faq"
          className="text-[rgb(var(--color-accent-primary))] hover:underline text-sm"
          target="_blank"
        >
          View Public FAQ &rarr;
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-[rgb(var(--color-error-bg))] text-[rgb(var(--color-error-text))] text-sm">
          {error}
        </div>
      )}

      {/* FAQ Items List */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] overflow-hidden"
          >
            {/* Item Header */}
            <div className="flex items-center gap-2 p-4">
              {/* Reorder Buttons */}
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0 || saving}
                  className="p-1 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] disabled:opacity-30"
                  aria-label="Move up"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === items.length - 1 || saving}
                  className="p-1 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] disabled:opacity-30"
                  aria-label="Move down"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Question (clickable to expand) */}
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="flex-1 text-left font-medium text-[rgb(var(--color-text-primary))]"
              >
                {item.question}
              </button>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEditing(item)}
                  disabled={saving}
                  className="px-2 py-1 text-sm text-[rgb(var(--color-accent-primary))] hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={saving}
                  className="px-2 py-1 text-sm text-[rgb(var(--color-error-text))] hover:underline"
                >
                  Delete
                </button>
                <svg
                  className={`w-5 h-5 text-[rgb(var(--color-text-muted))] transition-transform ${
                    expandedId === item.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded Content / Edit Form */}
            {expandedId === item.id && (
              <div className="border-t border-[rgb(var(--color-border-primary))] p-4">
                {editingId === item.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1">
                        Question
                      </label>
                      <input
                        type="text"
                        value={editQuestion}
                        onChange={(e) => setEditQuestion(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1">
                        Answer (Markdown)
                      </label>
                      <textarea
                        value={editAnswer}
                        onChange={(e) => setEditAnswer(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] resize-y"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate(item.id)}
                        disabled={saving || !editQuestion.trim() || !editAnswer.trim()}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-[rgb(var(--color-accent-primary))] text-white hover:bg-[rgb(var(--color-accent-hover))] disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={saving}
                        className="px-4 py-2 text-sm rounded-lg border border-[rgb(var(--color-border-primary))] hover:bg-[rgb(var(--color-bg-secondary))]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[rgb(var(--color-text-secondary))]">
                    <MarkdownRenderer content={item.answer} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add New FAQ Item */}
      {showAddForm ? (
        <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] p-4 space-y-4">
          <h3 className="font-medium text-[rgb(var(--color-text-primary))]">Add New FAQ</h3>
          <div>
            <label className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1">
              Question
            </label>
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Enter the question..."
              className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-1">
              Answer (Markdown)
            </label>
            <textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              rows={6}
              placeholder="Enter the answer..."
              className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] resize-y"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !newQuestion.trim() || !newAnswer.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[rgb(var(--color-accent-primary))] text-white hover:bg-[rgb(var(--color-accent-hover))] disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add FAQ"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewQuestion("");
                setNewAnswer("");
              }}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg border border-[rgb(var(--color-border-primary))] hover:bg-[rgb(var(--color-bg-secondary))]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full p-4 text-center text-[rgb(var(--color-accent-primary))] border-2 border-dashed border-[rgb(var(--color-border-primary))] rounded-lg hover:border-[rgb(var(--color-accent-primary))] hover:bg-[rgb(var(--color-bg-secondary))] transition-colors"
        >
          + Add New FAQ
        </button>
      )}
    </div>
  );
}
