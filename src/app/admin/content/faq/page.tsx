import { getFAQItems } from "@/lib/content";
import FAQEditor from "./FAQEditor";

export default async function AdminFAQPage() {
  const faqItems = await getFAQItems();

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
          Edit FAQ
        </h1>
        <p className="text-[rgb(var(--color-text-secondary))] mt-1">
          Manage frequently asked questions
        </p>
      </div>

      <FAQEditor initialItems={faqItems} />
    </div>
  );
}
