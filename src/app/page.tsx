import { createClient } from "@/lib/supabase/server";
import Onboarding from "./onboarding";
import Dashboard from "./dashboard";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { invite } = await searchParams;

  let invitationError = "";
  if (invite) {
    const { error } = await supabase.rpc("accept_invitation", { invite_token: invite });
    if (error && !error.message.includes("already belongs")) {
      invitationError = error.message.includes("another email")
        ? "Это приглашение предназначено для другой почты."
        : error.message.includes("expired")
          ? "Срок действия приглашения истёк. Попросите руководителя создать новое."
          : "Не удалось принять приглашение. Попросите руководителя создать новую ссылку.";
    }
  }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name,email,avatar_url,avatar_color").eq("id", user.id).single(),
    supabase.from("organization_members")
      .select("role,job_title,organization_id,organizations(name)")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!membership) {
    return <Onboarding name={profile?.full_name || user.user_metadata?.full_name || ""} invitationError={invitationError} />;
  }

  const [{ data: tasks }, { data: members }, { data: invitations }, { data: positions }, { data: responsibilities }, { data: metrics }, { data: personalDatabases }] = await Promise.all([
    supabase.from("tasks").select("*").eq("organization_id", membership.organization_id).order("created_at", { ascending: false }),
    supabase.from("organization_members")
      .select("user_id,role,job_title,position_id,is_notification_contact,work_start_time,profiles(full_name,email,employee_description,birth_date,avatar_url,avatar_color)")
      .eq("organization_id", membership.organization_id),
    supabase.from("invitations")
      .select("id,email,role,position_id,token,expires_at,accepted_at")
      .eq("organization_id", membership.organization_id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("positions")
      .select("id,name,parent_position_id,purpose")
      .eq("organization_id", membership.organization_id)
      .order("name"),
    supabase.from("responsibilities")
      .select("id,assignee_id,title,expected_result,is_active")
      .eq("organization_id", membership.organization_id)
      .eq("is_active", true)
      .order("created_at"),
    supabase.from("kpi_metrics")
      .select("id,assignee_id,name,description,unit,target_value,current_value,period,is_active")
      .eq("organization_id", membership.organization_id)
      .eq("is_active", true)
      .order("created_at"),
    supabase.from("personal_databases")
      .select("id,name,columns,records,created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  return (
    <Dashboard
      userId={user.id}
      name={profile?.full_name || ""}
      email={profile?.email || user.email || ""}
      avatarUrl={profile?.avatar_url || ""}
      avatarColor={profile?.avatar_color || "#7655d8"}
      organizationId={membership.organization_id}
      organizationName={(organization as { name?: string } | null)?.name || "Организация"}
      role={membership.role}
      initialTasks={tasks || []}
      members={members || []}
      initialInvitations={invitations || []}
      initialPositions={positions || []}
      initialResponsibilities={responsibilities || []}
      initialMetrics={metrics || []}
      initialDatabases={personalDatabases || []}
    />
  );
}
