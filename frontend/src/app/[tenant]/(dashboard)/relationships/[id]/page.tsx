import { notFound } from "next/navigation";
import { listRelationshipTypes } from "@/lib/relationship-types/server";
import { RelationshipViewWidget } from "./_components/RelationshipViewWidget";

export default async function RelationshipTypePage({
  params,
}: {
  params: { tenant: string; id: string };
}) {
  // Fetch all relationship types and find the one that matches the URL ID.
  const allTypes = await listRelationshipTypes();
  const relationshipType = allTypes?.find((t) => t.id === params.id);

  // If the ID in the URL is invalid or the type was deleted, show a 404 page.
  if (!relationshipType) {
    notFound();
  }

  return <RelationshipViewWidget relationshipType={relationshipType} />;
}
