import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { ComingSoonSection } from "@/components/ui/ComingSoonSection";
import { LegalIcon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

// Gated by authentication only, same as Priority Tracker -- no RBAC
// permission exists for this resource yet. Placeholder: the section is in
// the sidebar now so the planned nav structure is visible; real
// functionality lands later.
export default async function LegalPage({ params }: { params: { tenant: string } }) {
  const session = await getServerSession(params.tenant);
  if (!session) {
    redirect(`/${params.tenant}`);
  }

  return <ComingSoonSection title={t("legal.title")} subtitle={t("legal.subtitle")} icon={<LegalIcon size={22} />} />;
}
