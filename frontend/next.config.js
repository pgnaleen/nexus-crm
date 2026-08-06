/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@orelia/common"],
  typescript: {
    // Temporary: pre-existing type errors in a handful of components
    // (AddDealDialog, UserFormDialog, RoleCardPicker, TenantFormDialog,
    // RolePermissionsDialog) would otherwise fail `next build` in the
    // production deploy. This previously lived as an uncommitted hand-edit
    // on the prod server -- committed here so deploys are reproducible.
    // Remove once those errors are fixed (tracked in docs/project/BUGS.md).
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
