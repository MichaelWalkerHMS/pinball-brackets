"use client";

import { useState } from "react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import type { FAQItem } from "@/lib/types";

interface FAQAccordionProps {
  items: FAQItem[];
}

function FAQAccordionItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-[rgb(var(--color-border-primary))] rounded-lg bg-[rgb(var(--color-bg-primary))] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[rgb(var(--color-bg-secondary))] transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-lg font-semibold pr-4">{question}</span>
        <svg
          className={`w-5 h-5 flex-shrink-0 text-[rgb(var(--color-text-secondary))] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 pt-0">
          <MarkdownRenderer content={answer} />
        </div>
      </div>
    </div>
  );
}

export default function FAQAccordion({ items }: FAQAccordionProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FAQAccordionItem key={item.id} question={item.question} answer={item.answer} />
      ))}
    </div>
  );
}
