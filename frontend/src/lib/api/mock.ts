export interface MockRelationshipType {
  id: string;
  name: string;
  slug: string;
}

export interface MockFunnelStage {
  id: string;
  name: string;
  slug: string;
}

export async function getMockRelationshipTypes(): Promise<MockRelationshipType[]> {
  return [
    { id: "1", name: "Customers", slug: "customers" },
    { id: "2", name: "Suppliers", slug: "suppliers" },
    { id: "3", name: "Partners", slug: "partners" },
  ];
}

export async function getMockFunnelStages(): Promise<MockFunnelStage[]> {
  return [
    { id: "s1", name: "Lead", slug: "lead" },
    { id: "s2", name: "Contacted", slug: "contacted" },
    { id: "s3", name: "Proposal", slug: "proposal" },
    { id: "s4", name: "Negotiation", slug: "negotiation" },
  ];
}
