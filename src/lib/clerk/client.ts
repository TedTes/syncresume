const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

export function getClerkPublishableKey(): string {
  return clerkPublishableKey ?? "";
}

export function hasClerkConfig(): boolean {
  return Boolean(clerkPublishableKey);
}
