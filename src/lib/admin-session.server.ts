// Alias : ce n'est pas un hook React, la règle rules-of-hooks se fierait au préfixe « use ».
import { useSession as readSession } from "@tanstack/react-start/server";

type AdminSession = { unlocked?: boolean };

export function adminSessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "novazen-admin",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export function getAdminSession() {
  return readSession<AdminSession>(adminSessionConfig());
}

export async function assertAdminUnlocked(): Promise<void> {
  const session = await getAdminSession();
  if (session.data.unlocked !== true) {
    throw new Error("Accès administrateur verrouillé.");
  }
}
