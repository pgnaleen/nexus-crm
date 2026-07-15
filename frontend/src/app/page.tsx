import { redirect } from "next/navigation";

const DEFAULT_TENANT_SLUG = "system";

export default function HomePage() {
  redirect(`/${DEFAULT_TENANT_SLUG}`);
}
