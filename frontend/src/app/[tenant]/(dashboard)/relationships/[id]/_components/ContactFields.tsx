"use client";

import { RoleBuying } from "@orelia/common";
import { TextField } from "@/components/ui/TextField";
import { PhoneField } from "@/components/ui/PhoneField";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { email as emailValidator, validate } from "@/lib/validation";

const ROLE_BUYING_LABELS: Record<RoleBuying, string> = {
  [RoleBuying.EconomicBuyer]: "Economic Buyer",
  [RoleBuying.Champion]: "Champion",
  [RoleBuying.Influencer]: "Influencer",
  [RoleBuying.Gatekeeper]: "Gatekeeper",
  [RoleBuying.EndUser]: "End User",
  [RoleBuying.Blocker]: "Blocker",
};

export const ROLE_BUYING_OPTIONS = [
  { value: "", label: "Not set" },
  ...Object.values(RoleBuying).map((value) => ({ value, label: ROLE_BUYING_LABELS[value] })),
];

// The full set of "a contact is a person" fields -- shared by the standalone
// Add/Edit Contact dialog and the inline "add a contact" rows under Add
// Company, so a contact created either way ends up with the same data
// instead of the inline path silently collecting a stripped-down subset.
export interface ContactFieldsValue {
  fullName: string;
  title: string;
  department: string;
  roleBuying: RoleBuying | "";
  email: string;
  mobileNo: string;
  directPhoneNo: string;
  linkedIn: string;
  country: string;
  timezone: string;
}

interface ContactFieldsProps {
  values: ContactFieldsValue;
  onChange: (field: keyof ContactFieldsValue, value: string) => void;
  fullNameError?: string;
  // Standalone Add Contact requires a name outright; a draft row under Add
  // Company is simply skipped on submit if left blank, so it isn't marked
  // required there.
  fullNameRequired?: boolean;
}

export function ContactFields({ values, onChange, fullNameError, fullNameRequired }: ContactFieldsProps) {
  const emailError = values.email ? validate(values.email, [emailValidator()]) : undefined;

  return (
    <>
      <TextField
        label={fullNameRequired ? "Full name *" : "Full name"}
        value={values.fullName}
        error={fullNameError}
        placeholder="e.g. Jane Doe"
        onChange={(e) => onChange("fullName", e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3.5">
        <TextField
          label="Title"
          value={values.title}
          placeholder="e.g. Procurement Lead"
          onChange={(e) => onChange("title", e.target.value)}
        />
        <TextField
          label="Department"
          value={values.department}
          onChange={(e) => onChange("department", e.target.value)}
        />
      </div>

      <div className="mb-[18px]">
        <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">Buying role</label>
        <CustomSelect
          fullWidth
          label=""
          value={values.roleBuying}
          onChange={(val) => onChange("roleBuying", val)}
          options={ROLE_BUYING_OPTIONS}
        />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <TextField
          label="Email"
          type="email"
          value={values.email}
          error={emailError}
          placeholder="name@company.com"
          onChange={(e) => onChange("email", e.target.value)}
        />
        <PhoneField label="Mobile number" value={values.mobileNo} onChange={(val) => onChange("mobileNo", val)} />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <TextField
          label="Direct phone number"
          value={values.directPhoneNo}
          onChange={(e) => onChange("directPhoneNo", e.target.value)}
        />
        <TextField
          label="LinkedIn"
          value={values.linkedIn}
          onChange={(e) => onChange("linkedIn", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <CountrySelect
          label="Country"
          value={values.country}
          onChange={(val) => onChange("country", val)}
          placeholder="Search countries..."
        />
        <TextField
          label="Timezone"
          value={values.timezone}
          onChange={(e) => onChange("timezone", e.target.value)}
        />
      </div>
    </>
  );
}
