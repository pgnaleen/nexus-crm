import { getServerSession } from "@/lib/auth/session";
import { listEmployees } from "@/lib/employees/server";
import { listDepartmentsPicker } from "@/lib/pickers/server";
import { EmployeesWidget } from "./_components/EmployeesWidget";

export default async function EmployeesPage({
  params,
}: {
  params: { tenant: string };
}) {
  const [session, employees, departments] = await Promise.all([
    getServerSession(params.tenant),
    listEmployees(),
    listDepartmentsPicker(),
  ]);

  return (
    <EmployeesWidget
      key={session?.tenant.id ?? "none"}
      employees={employees ?? []}
      permissions={session?.permissions ?? []}
      departments={departments ?? []}
    />
  );
}
