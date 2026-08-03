import { getServerSession } from "@/lib/auth/session";
import { ActivityLogWidget } from "./_components/ActivityLogWidget";

// Mock-first pass (feature-development-guideline.md #1): ActivityLogWidget
// renders entirely from local mock data (mock-data.ts) for this review.
// No AUDIT_LOG_VIEW permission gate here yet either -- that permission key
// doesn't exist in the backend until Phase 2 (spec-activity-log.md section
// D), so gating on it now would make the page unreachable for everyone,
// including during this review. Both the gate and the real data wiring land
// together once the backend half is built and signed off.
export default async function ActivityLogPage({ params }: { params: { tenant: string } }) {
  const session = await getServerSession(params.tenant);

  return <ActivityLogWidget permissions={session?.permissions ?? []} />;
}
