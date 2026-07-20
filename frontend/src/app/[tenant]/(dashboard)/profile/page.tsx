import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { ProfileView } from "./_components/ProfileView";
import { ChangePasswordForm } from "./_components/ChangePasswordForm";

export default async function ProfilePage({ params }: { params: { tenant: string } }) {
  const session = await getServerSession(params.tenant);
  if (!session) {
    redirect(`/${params.tenant}`);
  }

  return (
    <div className="profile-page">
      <div className="content-card">
        <h2 className="content-card-title">My Profile</h2>
        <ProfileView session={session} />
      </div>

      <div className="content-card">
        <h2 className="content-card-title">Change Password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
