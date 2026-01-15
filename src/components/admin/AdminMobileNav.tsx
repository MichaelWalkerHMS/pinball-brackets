"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const ADMIN_NAV_LINKS = [
  { href: "/admin", label: "Tournaments" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/", label: "View Site" },
];

export default function AdminMobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key and return focus to button
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Focus first link when menu opens
  useEffect(() => {
    if (isOpen) {
      firstLinkRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div className="md:hidden relative" ref={menuRef}>
      {/* Hamburger button - 44x44 touch target */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] min-w-11 min-h-11 flex items-center justify-center"
        aria-label="Menu"
        aria-expanded={isOpen}
      >
        <svg
          className="w-6 h-6 text-[rgb(var(--color-text-secondary))]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-2 w-48 bg-[rgb(var(--color-bg-primary))] rounded-lg shadow-lg border border-[rgb(var(--color-border-primary))] z-50"
          role="menu"
        >
          <nav className="p-2">
            {ADMIN_NAV_LINKS.map((link, index) => (
              <Link
                key={link.href}
                ref={index === 0 ? firstLinkRef : undefined}
                href={link.href}
                className="block px-3 py-2 text-sm text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-bg-tertiary))] rounded-lg"
                onClick={() => setIsOpen(false)}
                role="menuitem"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
