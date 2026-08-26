export {};

// Create a type for the Roles
export type Roles = "farmer" | "factory";

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: Roles;
      onboardingComplete?: boolean;
    };
  }
}
