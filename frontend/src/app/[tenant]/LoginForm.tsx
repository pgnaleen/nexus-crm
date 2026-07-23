"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import { OreliaLogo } from "@/components/brand/OreliaLogo";
import { Button } from "@/components/ui/Button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { required, validate } from "@/lib/validation";
import styles from "./page.module.css";

interface FieldErrors {
  username?: string;
  password?: string;
}

export function LoginForm({ tenantSlug, tenantName }: { tenantSlug: string; tenantName: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateFields(): boolean {
    const errors: FieldErrors = {
      username: validate(username, [required("Username is required")]),
      password: validate(password, [required("Password is required")]),
    };
    setFieldErrors(errors);
    return !errors.username && !errors.password;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!validateFields()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ tenantSlug, username, password });
      router.push(`/${tenantSlug}/dashboard`);
      router.refresh();
      // Deliberately not reset here — the overlay stays up through the page
      // transition instead of flashing off right before navigation.
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Login failed");
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />

      <div className={styles.card}>
        <div className={styles.cardLogo}>
          <OreliaLogo size={34} showTagline={false} />
        </div>

        <h1 className={styles.title}>Welcome to {tenantName}</h1>
        <p className={styles.subtitle}>Sign in to continue</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <TextField
            label="Username"
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            error={fieldErrors.username}
            autoFocus
            autoComplete="username"
          />
          <PasswordField
            label="Password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            autoComplete="current-password"
          />

          {formError && <p className={styles.formError}>{formError}</p>}

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Sign in
          </Button>
        </form>
      </div>

      {isSubmitting && <LoadingOverlay label="Signing in…" />}
    </div>
  );
}
