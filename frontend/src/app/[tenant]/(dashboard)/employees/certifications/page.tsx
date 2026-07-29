import { redirect } from "next/navigation";
import { PERMISSIONS } from "@orelia/common";
import { getServerSession } from "@/lib/auth/session";
import { fetchPendingCertifications } from "@/lib/certifications/server";
import { PageTabs, type PageTab } from "@/components/ui/PageTabs";
import { t } from "@/lib/i18n";
import { CertificationReviewWidget } from "./_components/CertificationReviewWidget";
import { CertifiedSearchWidget } from "./_components/CertifiedSearchWidget";

// One merged "Certifications" page under HR, replacing what used to be two
// separate sidebar entries (Certified Employees, Certification Review) --
// they're now tabs here instead, following the same page-level tab pattern
// My Profile introduced (see PageTabs). "Pending Review" comes first since
// it's the actionable queue; "Certified Employees" is the lookup tool.
//
// Each tab is only included when the caller holds the permission it needs
// (mirrors how My Profile only includes its HR-record tabs when one
// exists) -- the panels themselves no longer re-check access.
export default async function CertificationsPage({ params }: { params: { tenant: string } }) {
  const session = await getServerSession(params.tenant);
  if (!session) {
    redirect(`/${params.tenant}`);
  }

  const canReview = session.permissions.includes(PERMISSIONS.EMPLOYEES_VERIFY_CERTIFICATIONS);
  const canView = session.permissions.includes(PERMISSIONS.EMPLOYEES_VIEW);

  // Only fetch the review queue when the caller may see it -- the endpoint
  // 403s otherwise.
  const pending = canReview ? await fetchPendingCertifications() : null;

  const tabs: PageTab[] = [
    ...(canReview
      ? [
          {
            id: "pending",
            label: t("certificationsHub.tabs.pending"),
            panel: <CertificationReviewWidget initial={pending ?? []} />,
          },
        ]
      : []),
    ...(canView
      ? [
          {
            id: "certified",
            label: t("certificationsHub.tabs.certified"),
            panel: <CertifiedSearchWidget />,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex flex-col">
        <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">{t("certificationsHub.title")}</h1>
        <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">{t("certificationsHub.subtitle")}</p>
      </div>

      {tabs.length === 0 ? (
        <div className="content-card">
          <div className="empty-state">
            <p className="empty-state-title">{t("certificationsHub.title")}</p>
            <p className="empty-state-message">{t("certificationsHub.noAccess")}</p>
          </div>
        </div>
      ) : (
        <PageTabs tabs={tabs} />
      )}
    </div>
  );
}
