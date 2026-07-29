import { createClient } from "@/lib/supabase/server";
import Onboarding from "./onboarding";
import Dashboard from "./dashboard";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user.id).single(),
    supabase.from("organization_members")
      .select("role,job_title,organization_id,organizations(name)")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!membership) {
    return <Onboarding name={profile?.full_name || user.user_metadata?.full_name || ""} />;
  }

  const [{ data: tasks }, { data: members }] = await Promise.all([
    supabase.from("tasks").select("*").eq("organization_id", membership.organization_id).order("created_at", { ascending: false }),
    supabase.from("organization_members")
      .select("user_id,role,job_title,profiles(full_name,email)")
      .eq("organization_id", membership.organization_id),
  ]);

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  return (
    <Dashboard
      userId={user.id}
      name={profile?.full_name || ""}
      email={profile?.email || user.email || ""}
      organizationId={membership.organization_id}
      organizationName={(organization as { name?: string } | null)?.name || "Организация"}
      role={membership.role}
      initialTasks={tasks || []}
      members={members || []}
    />
  );
}
