"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateMyPhoto } from "@/lib/api/employees";
import { uploadMyPhoto } from "@/lib/api/uploads";
import { ApiError } from "@/lib/api/client";
import { UploadCloudIcon } from "@/components/ui/icons";
import { useConfirm } from "@/components/providers/DialogProvider";
import { getInitials } from "@/lib/deals/deal-display";
import { t } from "@/lib/i18n";

interface ProfileAvatarProps {
  displayName: string;
  photoUrl: string | null;
  /** False when the login has no linked employee record — there's nothing to attach a photo to. */
  editable: boolean;
}

/**
 * The 72px avatar on My Profile, with self-service upload.
 *
 * Two calls, not one: POST /uploads/my-photo stores the file and returns an
 * S3 key, then PATCH /employees/me/photo attaches that key to the caller's own
 * employee record. Neither takes an employee id — the record is resolved from
 * the token — so a user can only ever change their own.
 *
 * The preview is optimistic so the new image appears immediately, but
 * router.refresh() still runs afterwards: the server-rendered signed URL is
 * what survives a reload, and the top-bar avatar reads the same source.
 */
export function ProfileAvatar({ displayName, photoUrl, editable }: ProfileAvatarProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice in a row still fires
    // onChange the second time.
    event.target.value = "";
    if (!file) return;

    setIsBusy(true);
    setError(null);
    try {
      const { key, previewUrl } = await uploadMyPhoto(file, displayName);
      await updateMyPhoto(key);
      setPreview(previewUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("profile.avatar.uploadFailed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemove() {
    const confirmed = await confirm({
      title: t("profile.avatar.removeConfirm.title"),
      message: t("profile.avatar.removeConfirm.message"),
      confirmLabel: t("profile.avatar.removeConfirm.confirmLabel"),
    });
    if (!confirmed) return;

    setIsBusy(true);
    setError(null);
    try {
      await updateMyPhoto(null);
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("profile.avatar.removeFailed"));
    } finally {
      setIsBusy(false);
    }
  }

  const circle = preview ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={preview}
      alt=""
      className="h-[72px] w-[72px] rounded-full border border-[var(--color-border)] object-cover"
    />
  ) : (
    <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-crm-primary-tint text-2xl font-bold text-crm-primary">
      {getInitials(displayName)}
    </div>
  );

  if (!editable) {
    return <div className="shrink-0">{circle}</div>;
  }

  return (
    <div className="shrink-0">
      <div className="group relative h-[72px] w-[72px]">
        {circle}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isBusy}
          // Always reachable by keyboard/screen-reader; only the tint fades in
          // on hover, so the avatar itself stays clean at rest.
          className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full border-none bg-black/50 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-wait"
          aria-label={t(preview ? "profile.avatar.change" : "profile.avatar.add")}
          title={t(preview ? "profile.avatar.change" : "profile.avatar.add")}
        >
          <UploadCloudIcon size={18} />
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {preview && !isBusy && (
        <button
          type="button"
          onClick={handleRemove}
          className="mt-1.5 w-[72px] cursor-pointer border-none bg-transparent p-0 text-center text-[11px] text-[var(--color-text-muted)] underline-offset-2 hover:underline"
        >
          {t("profile.avatar.remove")}
        </button>
      )}

      {isBusy && (
        <p className="mt-1.5 w-[72px] text-center text-[11px] text-[var(--color-text-muted)]">
          {t("profile.avatar.working")}
        </p>
      )}

      {error && <p className="mt-1.5 text-[11px] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
