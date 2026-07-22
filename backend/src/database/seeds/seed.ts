import "reflect-metadata";
import * as bcrypt from "bcrypt";
import * as dotenv from "dotenv";
import { PERMISSIONS, RbacRiskLevel, SYSTEM_TENANT_SLUG, TenantStatus, UserStatus } from "@orelia/common";
import { RbacResource } from "../../modules/rbac/entities/rbac-resource.entity";
import { RbacRole } from "../../modules/rbac/entities/rbac-role.entity";
import { RbacRoleResourceMap } from "../../modules/rbac/entities/rbac-role-resource-map.entity";
import { RbacRoleUserMap } from "../../modules/rbac/entities/rbac-role-user-map.entity";
import { Industry } from "../../modules/tenants/entities/industry.entity";
import { Plan } from "../../modules/tenants/entities/plan.entity";
import { Tenant } from "../../modules/tenants/entities/tenant.entity";
import { User } from "../../modules/users/entities/user.entity";
import AppDataSource from "../data-source";

dotenv.config();

const DEFAULT_INDUSTRIES = [
  "Software & Technology",
  "Financial Services",
  "Healthcare",
  "Manufacturing",
  "Retail & E-commerce",
  "Professional Services",
];

const DEFAULT_PLANS: { name: string; amount: number }[] = [
  { name: "Trial", amount: 0 },
  { name: "Starter", amount: 49 },
  { name: "Pro", amount: 199 },
  { name: "Enterprise", amount: 999 },
];

// Risk_Level (per the RBAC_Resources ER column) is derived from the permission's
// action suffix rather than hand-assigned for every key: destructive/broad actions
// (delete, disable, manage) are High risk; create/update are Medium; the rest (mostly
// read) default to Low.
const HIGH_RISK_ACTIONS = ["manage", "disable", "delete"];

function riskLevelFor(permissionKey: string): RbacRiskLevel {
  const action = permissionKey.split(":").pop();
  if (action && HIGH_RISK_ACTIONS.includes(action)) {
    return RbacRiskLevel.High;
  }
  if (action === "update" || action === "create") {
    return RbacRiskLevel.Medium;
  }
  return RbacRiskLevel.Low;
}

// Resources only the System tenant's Super Admin may ever hold — tenant admins
// building their own custom roles never see or can grant these.
const PLATFORM_ONLY_PERMISSIONS: string[] = [
  PERMISSIONS.PLATFORM_IMPERSONATE_TENANT,
  PERMISSIONS.TENANTS_VIEW,
  PERMISSIONS.TENANTS_CREATE,
  PERMISSIONS.TENANTS_UPDATE,
  PERMISSIONS.TENANTS_DELETE,
];

const SYSTEM_TENANT_PLAN_NAME = "Enterprise";
const SUPER_ADMIN_ROLE_NAME = "Super Admin";
const ADMIN_USERNAME = "admin";
const ADMIN_DEFAULT_PASSWORD = "ChangeMe123!";

async function seedIndustries(): Promise<void> {
  const repo = AppDataSource.getRepository(Industry);
  for (const name of DEFAULT_INDUSTRIES) {
    const existing = await repo.findOneBy({ name });
    if (!existing) {
      await repo.save(repo.create({ name }));
      console.log(`  + industry: ${name}`);
    }
  }
}

async function seedPlans(): Promise<Map<string, Plan>> {
  const repo = AppDataSource.getRepository(Plan);
  const map = new Map<string, Plan>();
  for (const { name, amount } of DEFAULT_PLANS) {
    let plan = await repo.findOneBy({ name });
    if (!plan) {
      plan = await repo.save(repo.create({ name, amount }));
      console.log(`  + plan: ${name}`);
    }
    map.set(name, plan);
  }
  return map;
}

async function seedRbacResources(): Promise<RbacResource[]> {
  const repo = AppDataSource.getRepository(RbacResource);
  const resources: RbacResource[] = [];
  for (const key of Object.values(PERMISSIONS)) {
    let resource = await repo.findOneBy({ name: key });
    if (!resource) {
      resource = await repo.save(
        repo.create({
          name: key,
          description: `Permission: ${key}`,
          riskLevel: riskLevelFor(key),
          isPlatformOnly: PLATFORM_ONLY_PERMISSIONS.includes(key),
        }),
      );
      console.log(`  + rbac resource: ${key}`);
    }
    resources.push(resource);
  }
  return resources;
}

async function seedSystemTenant(plan: Plan): Promise<Tenant> {
  const repo = AppDataSource.getRepository(Tenant);
  let tenant = await repo.findOneBy({ slug: SYSTEM_TENANT_SLUG });
  if (!tenant) {
    tenant = await repo.save(
      repo.create({
        name: "System",
        slug: SYSTEM_TENANT_SLUG,
        planId: plan.id,
        status: TenantStatus.Active,
      }),
    );
    console.log(`  + tenant: System (${SYSTEM_TENANT_SLUG})`);
  }
  return tenant;
}

async function seedSuperAdminRole(tenant: Tenant, resources: RbacResource[]): Promise<RbacRole> {
  const roleRepo = AppDataSource.getRepository(RbacRole);
  const mapRepo = AppDataSource.getRepository(RbacRoleResourceMap);

  let role = await roleRepo.findOneBy({ tenantId: tenant.id, name: SUPER_ADMIN_ROLE_NAME });
  if (!role) {
    role = await roleRepo.save(
      roleRepo.create({
        tenantId: tenant.id,
        name: SUPER_ADMIN_ROLE_NAME,
        description: "Full platform access across every resource",
      }),
    );
    console.log(`  + role: ${SUPER_ADMIN_ROLE_NAME}`);
  }

  for (const resource of resources) {
    const existingMap = await mapRepo.findOneBy({ roleId: role.id, resourceId: resource.id });
    if (!existingMap) {
      await mapRepo.save(mapRepo.create({ roleId: role.id, resourceId: resource.id }));
    }
  }
  console.log(`  + granted ${resources.length} resources to ${SUPER_ADMIN_ROLE_NAME}`);

  return role;
}

async function seedAdminUser(tenant: Tenant, role: RbacRole): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);
  const mapRepo = AppDataSource.getRepository(RbacRoleUserMap);

  let user = await userRepo.findOneBy({ tenantId: tenant.id, username: ADMIN_USERNAME });
  if (!user) {
    const passwordHash = await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, 12);
    user = await userRepo.save(
      userRepo.create({
        tenantId: tenant.id,
        username: ADMIN_USERNAME,
        passwordHash,
        displayName: "System Administrator",
        loggingEmail: "admin@system.orelia.local",
        status: UserStatus.Active,
        mustChangePassword: true,
      }),
    );
    console.log(
      `  + user: ${ADMIN_USERNAME} (tenant=${SYSTEM_TENANT_SLUG}, password=${ADMIN_DEFAULT_PASSWORD})`,
    );
  }

  const existingMap = await mapRepo.findOneBy({ roleId: role.id, userId: user.id });
  if (!existingMap) {
    await mapRepo.save(mapRepo.create({ roleId: role.id, userId: user.id }));
    console.log(`  + assigned ${SUPER_ADMIN_ROLE_NAME} to ${ADMIN_USERNAME}`);
  }
}

async function run(): Promise<void> {
  await AppDataSource.initialize();

  console.log("Seeding industries...");
  await seedIndustries();

  console.log("Seeding plans...");
  const plans = await seedPlans();

  console.log("Seeding RBAC resources...");
  const resources = await seedRbacResources();

  console.log("Seeding system tenant...");
  const systemPlan = plans.get(SYSTEM_TENANT_PLAN_NAME);
  if (!systemPlan) {
    throw new Error(`${SYSTEM_TENANT_PLAN_NAME} plan was not seeded`);
  }
  const tenant = await seedSystemTenant(systemPlan);

  console.log("Seeding Super Admin role...");
  const role = await seedSuperAdminRole(tenant, resources);

  console.log("Seeding admin user...");
  await seedAdminUser(tenant, role);

  console.log("\nSeed complete.");
  console.log(
    `Login with tenantSlug="${SYSTEM_TENANT_SLUG}" username="${ADMIN_USERNAME}" password="${ADMIN_DEFAULT_PASSWORD}"`,
  );

  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
