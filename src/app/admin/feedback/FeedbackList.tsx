"use client";

import { useState } from "react";
import type { Feedback } from "@/lib/types";
import { deleteFeedback } from "./actions";

interface FeedbackListProps {
  feedback: Feedback[];
}

export default function FeedbackList({ feedback: initialFeedback }: FeedbackListProps) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this feedback?")) {
      return;
    }

    setDeletingId(id);
    const result = await deleteFeedback(id);

    if (result?.error) {
      alert(result.error);
      setDeletingId(null);
    } else {
      setFeedback((prev) => prev.filter((f) => f.id !== id));
      setDeletingId(null);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function truncateMessage(message: string, maxLength: number = 100) {
    if (message.length <= maxLength) return message;
    return message.slice(0, maxLength) + "...";
  }

  if (feedback.length === 0) {
    return (
      <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg p-8 text-center border border-[rgb(var(--color-border-primary))]">
        <svg
          className="w-12 h-12 mx-auto text-[rgb(var(--color-text-muted))] mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <p className="text-[rgb(var(--color-text-muted))]">No feedback yet</p>
      </div>
    );
  }

  return (
    <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] overflow-hidden">
      <table className="w-full">
        <thead className="bg-[rgb(var(--color-bg-tertiary))]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--color-text-secondary))] uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--color-text-secondary))] uppercase tracking-wider">
              Page
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[rgb(var(--color-text-secondary))] uppercase tracking-wider">
              Message
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-[rgb(var(--color-text-secondary))] uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgb(var(--color-border-primary))]">
          {feedback.map((item) => {
            const isExpanded = expandedId === item.id;
            const isDeleting = deletingId === item.id;

            return (
              <tr
                key={item.id}
                className={`hover:bg-[rgb(var(--color-bg-secondary))] ${isDeleting ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3 text-sm text-[rgb(var(--color-text-secondary))] whitespace-nowrap">
                  {formatDate(item.created_at)}
                </td>
                <td className="px-4 py-3 text-sm text-[rgb(var(--color-text-secondary))]">
                  {item.page_url || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-[rgb(var(--color-text-primary))]">
                  <div>
                    {isExpanded ? item.message : truncateMessage(item.message)}
                  </div>
                  {item.message.length > 100 && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="text-xs text-[rgb(var(--color-accent-primary))] hover:underline mt-1"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={isDeleting}
                    className="text-[rgb(var(--color-error-text))] hover:text-[rgb(var(--color-error-border))] disabled:opacity-50"
                    aria-label="Delete feedback"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
