import { redirect } from "next/navigation";
import FarmerDashboard from "@/components/dashboard/FarmerDashboard";
import BuyerDashboard from "@/components/dashboard/FactoryDashboard";
import { getCurrentUserWithRole } from "@/lib/auth";
import {
  EMPTY_FACTORY_DASHBOARD,
  EMPTY_FARMER_DASHBOARD,
} from "@/lib/dashboard";
import {
  getFactoryDashboard,
  getFarmerDashboard,
} from "@/lib/dashboard.server";

/**
 * The workspace behind /dashboard, one screen per role.
 *
 * Both readings happen here rather than being fetched from the browser: this
 * is a server component, so calling `/api/dashboard/*` would be a round trip
 * back into the same process, and the home screen would flash empty while it
 * ran. A read that fails still renders the screen, empty and with the reason
 * on it, rather than replacing the whole workspace with an error.
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
    const workspace = await getFactoryDashboard(user.id);

    return (
      <BuyerDashboard
        factoryName={user.factoryName ?? undefined}
        data={workspace.ok ? workspace.data : EMPTY_FACTORY_DASHBOARD}
        error={workspace.ok ? undefined : workspace.error}
      />
    );
  }

  redirect("/");
};

export default DashboardPage;
