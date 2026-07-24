import { PERMISSIONS } from "@orelia/common";
import { getServerSession } from "@/lib/auth/session";
import { fetchPendingCertifications } from "@/lib/certifications/server";
import { CertificationReviewWidget } from "./_components/CertificationReviewWidget";

export default async function CertificationReviewPage({
  params,
}: {
  params: { tenant: string };
}) {
  const session = await getServerSession(params.tenant);
  const canReview = session?.permissions.includes(PERMISSIONS.EMPLOYEES_VERIFY_CERTIFICATIONS) ?? false;
  // Only fetch the queue when the caller may see it -- the endpoint 403s
  // otherwise, and the widget renders a no-access state.
  const pending = canReview ? await fetchPendingCertifications() : null;

  return (
    <CertificationReviewWidget
      key={session?.tenant.id ?? "none"}
      canReview={canReview}
      initial={pending ?? []}
    />
  );
}
