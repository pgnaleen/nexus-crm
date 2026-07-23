"use client";

import { useState, type FormEvent } from "react";
import { EmploymentStatus } from "@orelia/common";
import type { EmployeeDetailResponse, EmployeeListItemResponse } from "@orelia/common";
import { updateEmployee } from "@/lib/api/employees";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { t } from "@/lib/i18n";
import { EMPLOYMENT_STATUS_LABELS } from "./employeeLabels";

// Story 1.5 -- "Mark as Exited". Deliberately a plain PATCH of
// employmentStatus + dateOfExit (not a delete): the record stays fully
// visible in the directory and history is preserved for compliance. The
// separate, EMPLOYEES_DELETE-gated Delete action is for records created by
// mistake -- see EmployeesWidget's delete confirm.
const EXITED_STATUS_OPTIONS = [EmploymentStatus.Terminated, EmploymentStatus.Resigned].map((value) => ({
  value,
  label: EMPLOYMENT_STATUS_LABELS[value],
}));

interface EmployeeExitDialogProps {
  // Launched from a directory row's action icon -- only needs the row's own
  // id/name, the PATCH response supplies the fresh full record.
  employee: EmployeeListItemResponse;
  onClose: () => void;
  onExited: (employee: EmployeeDetailResponse) => void;
}

export function EmployeeExitDialog({ employee, onClose, onExited }: EmployeeExitDialogProps) {
  const [status, setStatus] = useState<EmploymentStatus>(EmploymentStatus.Resigned);
  const [dateOfExit, setDateOfExit] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!dateOfExit) {
      setDateError(t("employees.exitDialog.errors.dateRequired"));
      return;
    }
    setDateError(null);

    setIsSaving(true);
    try {
      const updated = await updateEmployee(employee.id, {
        employmentStatus: status,
        dateOfExit,
      });
      onExited(updated);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("employees.exitDialog.errors.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open title={t("employees.exitDialog.title")} onClose={onClose} maxWidth="480px">
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-[13.5px] text-[var(--color-text-muted)]">
          {t("employees.exitDialog.message", { name: employee.fullName })}
        </p>

        {formError && <p className="mb-3 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}

        <div className="mb-[18px]">
          <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
            {t("employees.exitDialog.statusLabel")}
          </label>
          <CustomSelect
            fullWidth
            label=""
            value={status}
            onChange={(val) => setStatus(val as EmploymentStatus)}
            options={EXITED_STATUS_OPTIONS}
          />
        </div>

        <TextField
          label={t("employees.exitDialog.dateLabel")}
          name="dateOfExit"
          type="date"
          value={dateOfExit}
          error={dateError ?? undefined}
          onChange={(e) => setDateOfExit(e.target.value)}
        />

        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {t("employees.exitDialog.confirmButton")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
