"use client";

import { RoleBuying } from "@orelia/common";
import { TextField } from "@/components/ui/TextField";
import { PhoneField } from "@/components/ui/PhoneField";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { TimezoneSelect } from "@/components/ui/TimezoneSelect";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { email as emailValidator, linkedInUrl, validate } from "@/lib/validation";

export const ROLE_BUYING_LABELS: Record<RoleBuying, string> = {
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
  errors?: Partial<Record<keyof ContactFieldsValue, string>>;
  // Standalone Add Contact requires a name outright; a draft row under Add
  // Company is simply skipped on submit if left blank, so it isn't marked
  // required there.
  fullNameRequired?: boolean;
  disabled?: boolean;
}

export function ContactFields({ values, onChange, errors, fullNameRequired, disabled }: ContactFieldsProps) {
  const emailError = values.email ? validate(values.email, [emailValidator()]) : undefined;
  const linkedInError = errors?.linkedIn ?? (values.linkedIn ? validate(values.linkedIn, [linkedInUrl()]) : undefined);

  return (
    <div className="space-y-4">
      {/* Identity Card */}
      <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
        <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Identity & Role</span>
        </div>
        <div className="space-y-1">
          <TextField
            label={fullNameRequired ? "Full name *" : "Full name"}
            value={values.fullName}
            error={errors?.fullName}
            placeholder="e.g. Jane Doe"
            disabled={disabled}
            onChange={(e) => onChange("fullName", e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3.5">
            <TextField
              label="Title"
              value={values.title}
              placeholder="e.g. Procurement Lead"
              disabled={disabled}
              onChange={(e) => onChange("title", e.target.value)}
            />
            <TextField
              label="Department"
              value={values.department}
              placeholder="e.g. Finance"
              disabled={disabled}
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
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Contact Details Card */}
      <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
        <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Contact Information</span>
        </div>
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-3.5">
            <TextField
              label="Email"
              type="email"
              value={values.email}
              error={emailError}
              placeholder="name@company.com"
              disabled={disabled}
              onChange={(e) => onChange("email", e.target.value)}
            />
            <PhoneField
              label="Mobile number"
              value={values.mobileNo}
              error={errors?.mobileNo}
              disabled={disabled}
              onChange={(val) => onChange("mobileNo", val)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <PhoneField
              label="Direct phone number"
              value={values.directPhoneNo}
              error={errors?.directPhoneNo}
              disabled={disabled}
              onChange={(val) => onChange("directPhoneNo", val)}
            />
            <TextField
              label="LinkedIn"
              value={values.linkedIn}
              error={linkedInError}
              placeholder="https://www.linkedin.com/in/..."
              disabled={disabled}
              onChange={(e) => onChange("linkedIn", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Geographics Card */}
      <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
        <div className="flex items-center gap-2 mb-3.5 border-b border-slate-100 pb-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Location & Timezone</span>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <CountrySelect
            label="Country"
            value={values.country}
            onChange={(val) => onChange("country", val)}
            placeholder="Search countries..."
            disabled={disabled}
          />
          <TimezoneSelect
            label="Timezone"
            value={values.timezone}
            onChange={(val) => onChange("timezone", val)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
