"use client";

interface RoleCardPickerOption {
  value: string;
  label: string;
  description?: string;
}

interface RoleCardPickerProps {
  options: RoleCardPickerOption[];
  values: string[];
  onChange: (values: string[]) => void;
}

/** Returns a deterministic color index (0-5) for a role name */
function colorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return hash % 6;
}

/** Returns the first two letters of the role name as an avatar */
function roleInitials(name: string): string {
  const parts = name.trim().split(/[\s_-]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const COLOR_CLASSES = [
  "role-card-avatar--blue",
  "role-card-avatar--purple",
  "role-card-avatar--green",
  "role-card-avatar--amber",
  "role-card-avatar--rose",
  "role-card-avatar--teal",
];

export function RoleCardPicker({ options, values, onChange }: RoleCardPickerProps) {
  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  }

  if (options.length === 0) {
    return (
      <div className="role-card-picker-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
        No roles available
      </div>
    );
  }

  return (
    <div className="role-card-picker">
      {options.map((opt) => {
        const isSelected = values.includes(opt.value);
        const avatarClass = COLOR_CLASSES[colorIndex(opt.label)];
        return (
          <button
            key={opt.value}
            type="button"
            className={`role-card${isSelected ? " is-selected" : ""}`}
            onClick={() => toggle(opt.value)}
            aria-pressed={isSelected}
          >
            <div className={`role-card-avatar ${avatarClass}`}>
              {roleInitials(opt.label)}
            </div>
            <div className="role-card-body">
              <span className="role-card-name">{opt.label}</span>
              {opt.description && (
                <span className="role-card-desc">{opt.description}</span>
              )}
            </div>
            <div className="role-card-check" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </button>
        );
      })}
    </div>
  );
}
