"use client";

import { useState, type FormEvent } from "react";
import type { CertifiedEmployeeResponse } from "@orelia/common";
import { searchCertifiedEmployees } from "@/lib/api/certifications";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

// Story 1.14 -- search employees by a VERIFIED certification name. Only
// verified claims ever surface here (the backend filters); expired certs
// are shown with their expiry date rather than hidden, so the searcher
// judges relevance themselves.
//
// This is the "Certified Employees" tab of the Certifications page --
// access gating happens one level up, in page.tsx, by only including this
// tab when the caller holds EMPLOYEES_VIEW (mirrors how Profile's own tabs
// are conditionally included rather than each panel re-checking access).
export function CertifiedSearchWidget() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CertifiedEmployeeResponse[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const name = query.trim();
    if (!name) return;
    setIsSearching(true);
    setError(null);
    try {
      const matches = await searchCertifiedEmployees(name);
      setResults(matches);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("certifiedSearch.errors.searchFailed"));
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={handleSearch}
        className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3"
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-[10px] -translate-y-1/2 text-[var(--color-text-muted)]">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder={t("certifiedSearch.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
          />
        </div>
        <Button type="submit" isLoading={isSearching} disabled={!query.trim()}>
          {t("certifiedSearch.searchButton")}
        </Button>
      </form>

      {error && <p className="mb-4 text-[13px] text-[var(--color-danger)]">{error}</p>}

      {results === null ? (
        <div className="empty-state">
          <p className="empty-state-title">{t("certifiedSearch.promptTitle")}</p>
          <p className="empty-state-message">{t("certifiedSearch.promptMessage")}</p>
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">{t("certifiedSearch.noMatchTitle")}</p>
          <p className="empty-state-message">{t("certifiedSearch.noMatchMessage")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {[
                  t("certifiedSearch.table.employee"),
                  t("certifiedSearch.table.department"),
                  t("certifiedSearch.table.certification"),
                  t("certifiedSearch.table.issuer"),
                  t("certifiedSearch.table.expires"),
                ].map((heading) => (
                  <th
                    key={heading}
                    className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.certificationId} className="[&:last-child>td]:border-b-0">
                  <td className="border-b border-[var(--color-border)] p-3 font-medium text-crm-text">
                    {row.employeeName}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {row.departmentName ?? t("employees.notSet")}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{row.name}</td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {row.issuingOrganization}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {row.expiryDate ?? t("certifiedSearch.noExpiry")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
