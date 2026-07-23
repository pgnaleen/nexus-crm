import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { fetchMyEmployeeRecord } from "@/lib/employees/server";
import { t } from "@/lib/i18n";
import { ProfileView } from "./_components/ProfileView";
import { ChangePasswordForm } from "./_components/ChangePasswordForm";
import { MyEmployeeRecord } from "./_components/MyEmployeeRecord";

export default async function ProfilePage({ params }: { params: { tenant: string } }) {
  const session = await getServerSession(params.tenant);
  if (!session) {
    redirect(`/${params.tenant}`);
  }

  // Story 1.11 -- own HR record, present only when this login is linked to
  // an Employee (Story 1.6). Unlinked accounts see no section at all.
  const employeeRecord = await fetchMyEmployeeRecord();

  return (
    <div className="profile-page">
      <div className="content-card">
        <h2 className="content-card-title">My Profile</h2>
        <ProfileView session={session} />
      </div>

      {employeeRecord && (
        <div className="content-card">
          <h2 className="content-card-title">{t("profile.employeeRecord.title")}</h2>
          <MyEmployeeRecord record={employeeRecord} />
        </div>
      )}

      <div className="content-card">
        <h2 className="content-card-title">Change Password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
