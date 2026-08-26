import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const OnboardingLayout = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  if ((await auth()).sessionClaims?.metadata.onboardingComplete === true) {
    redirect("/dashboard");
  }

  return <>{children}</>;
};

export default OnboardingLayout;
