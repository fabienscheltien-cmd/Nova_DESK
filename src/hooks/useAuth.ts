import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isAllowed: boolean;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    const resolve = async (next: Session | null) => {
      if (!active) return;
      setSession(next);
      if (!next?.user) {
        setIsAdmin(false);
        setIsAllowed(false);
        setLoading(false);
        return;
      }

      const email = next.user.email ?? "";
      const domain = email.split("@")[1]?.toLowerCase() ?? "";

      const [roles, domains] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", next.user.id),
        supabase.from("allowed_domains").select("domain").eq("active", true),
      ]);

      if (!active) return;
      const admin = (roles.data ?? []).some((r) => r.role === "admin");
      const allowed =
        admin || (domains.data ?? []).some((d) => d.domain.toLowerCase() === domain);
      setIsAdmin(admin);
      setIsAllowed(allowed);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      void resolve(next);
    });

    void supabase.auth.getSession().then(({ data }) => resolve(data.session));

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { loading, session, user: session?.user ?? null, isAdmin, isAllowed };
}
