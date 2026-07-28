import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { fetchMyEmployeeRecord } from "@/lib/employees/server";
import { fetchMyCertifications } from "@/lib/certifications/server";
import { t } from "@/lib/i18n";
import { ProfileHeader } from "./_components/ProfileHeader";
import { ProfileTabs, type ProfileTab } from "./_components/ProfileTabs";
import { ProfileView } from "./_components/ProfileView";
import { ChangePasswordForm } from "./_components/ChangePasswordForm";
import { MyEmployeeRecord } from "./_components/MyEmployeeRecord";
import { MyCertifications } from "./_components/MyCertifications";

export default async function ProfilePage({ params }: { params: { tenant: string } }) {
  const session = await getServerSession(params.tenant);
  if (!session) {
    redirect(`/${params.tenant}`);
  }

  // Story 1.11 -- own HR record, present only when this login is linked to
  // an Employee (Story 1.6). Unlinked accounts see no section at all.
  const employeeRecord = await fetchMyEmployeeRecord();
  // Story 1.12 -- own certifications, self-service. Only meaningful when the
  // account is linked to an employee (the backend 403s otherwise), so the
  // section is gated on the same linked-employee condition.
  const certifications = employeeRecord ? await fetchMyCertifications() : null;

  // Panels are rendered here, on the server, and handed to the client tab
  // shell as finished trees -- so MyEmployeeRecord/ProfileView stay Server
  // Components even though tab switching is client state.
  //
  // HR record first when there is one: it's the tab people actually come for.
  // Unlinked accounts start on Account instead, since the first two tabs
  // simply don't exist for them.
  const tabs: ProfileTab[] = [
    ...(employeeRecord
      ? [
          {
            id: "employeeRecord",
            label: t("profile.tabs.employeeRecord"),
            panel: <MyEmployeeRecord record={employeeRecord} />,
          },
          {
            id: "certifications",
            label: t("profile.tabs.certifications"),
            panel: <MyCertifications initial={certifications ?? []} />,
          },
        ]
      : []),
    {
      id: "account",
      label: t("profile.tabs.account"),
      panel: <ProfileView session={session} />,
    },
    {
      id: "security",
      label: t("profile.tabs.security"),
      panel: (
        <div>
          <p className="m-0 mb-4 text-[12.5px] text-[var(--color-text-muted)]">
            {t("profile.security.hint")}
          </p>
          <ChangePasswordForm />
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
      <ProfileHeader session={session} record={employeeRecord} />
      <ProfileTabs tabs={tabs} />
    </div>
  );
}
