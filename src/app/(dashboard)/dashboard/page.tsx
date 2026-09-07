import { redirect } from "next/navigation";
import FarmerDashboard from "@/components/dashboard/FarmerDashboard";
import BuyerDashboard from "@/components/dashboard/FactoryDashboard";
import { getCurrentUserWithRole } from "@/lib/auth";
import { EMPTY_FARMER_DASHBOARD } from "@/lib/dashboard";
import { getFarmerDashboard } from "@/lib/dashboard.server";

/**
 * The workspace behind /dashboard, one screen per role.
 *
 * The farmer figures are read here rather than fetched from the browser: this
 * is a server component, so calling `/api/dashboard/farmer` would be a round
 * trip back into the same process, and the home screen would flash empty while
 * it ran.
 */

export const dynamic = "force-dynamic";

const DashboardPage = async () => {
  const user = await getCurrentUserWithRole();

  if (!user) {
    redirect("/");
  }

  if (user.role === "farmer") {
    const workspace = await getFarmerDashboard(user.id);

    return (
      <FarmerDashboard
        userName={user.firstName ?? undefined}
        data={workspace.ok ? workspace.data : EMPTY_FARMER_DASHBOARD}
        error={workspace.ok ? undefined : workspace.error}
      />
    );
  }

  if (user.role === "factory") {
    return (
      <BuyerDashboard
      // buyerName={user.factoryName}
      // userName={user.firstName ?? undefined}
      />
    );
  }

  redirect("/");
};

export default DashboardPage;
