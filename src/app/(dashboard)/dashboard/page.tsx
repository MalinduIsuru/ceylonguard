import { redirect } from "next/navigation";
import FarmerDashboard from "@/components/dashboard/FarmerDashboard";
import BuyerDashboard from "@/components/dashboard/FactoryDashboard";
import { getCurrentUserWithRole } from "@/lib/auth";

const DashboardPage = async () => {
  const user = await getCurrentUserWithRole();

  if (!user) {
    redirect("/");
  }

  if (user.role === "farmer") {
    return (
      <FarmerDashboard
      // userName={user.firstName ?? undefined}
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
