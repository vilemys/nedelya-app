"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Task = { id: string; owner_id: string; title: string; status: string; priority: string; due_date: string | null; created_at?: string; completed_at?: string | null };
type MemberProfile = { full_name?: string; email?: string; employee_description?: string; birth_date?: string | null; avatar_url?: string | null; avatar_color?: string };
type Member = { user_id: string; role: string; job_title: string | null; position_id: string | null; is_notification_contact: boolean; work_start_time: string | null; profiles: MemberProfile | MemberProfile[] | null };
type Invitation = { id: string; email: string; role: string; position_id: string | null; token: string; expires_at: string; accepted_at: string | null };
type Position = { id: string; name: string; parent_position_id: string | null; purpose: string };
type Responsibility = { id: string; assignee_id: string; title: string; expected_result: string; is_active: boolean };
type KpiMetric = { id: string; assignee_id: string | null; name: string; description: string; unit: string; target_value: number; current_value: number; period: "week" | "month" | "quarter"; is_active: boolean };
type PersonalDatabase = { id: string; name: string; columns: string[]; records: Record<string, string>[]; created_at: string };

export default function Dashboard(props: {
  userId: string; name: string; email: string; avatarUrl: string; avatarColor: string; organizationId: string; organizationName: string;
  role: "owner" | "manager" | "employee"; initialTasks: Task[]; members: Member[];
  initialInvitations: Invitation[]; initialPositions: Position[]; initialResponsibilities: Responsibility[]; initialMetrics: KpiMetric[]; initialDatabases: PersonalDatabase[];
}) {
  const [tasks, setTasks] = useState(props.initialTasks);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tab, setTab] = useState<"tasks" | "stats" | "duties" | "structure" | "kpi" | "database" | "team">("tasks");
  const [busy, setBusy] = useState(false);
  const [invitations, setInvitations] = useState(props.initialInvitations);
  const [members, setMembers] = useState(props.members);
  const [positions, setPositions] = useState(props.initialPositions);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "employee">("employee");
  const [invitePositionId, setInvitePositionId] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [positionMessage, setPositionMessage] = useState("");
  const [responsibilities, setResponsibilities] = useState(props.initialResponsibilities);
  const [responsibilityAssignee, setResponsibilityAssignee] = useState(props.members[0]?.user_id || "");
  const [responsibilityTitle, setResponsibilityTitle] = useState("");
  const [responsibilityResult, setResponsibilityResult] = useState("");
  const [responsibilityMessage, setResponsibilityMessage] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [metrics, setMetrics] = useState(props.initialMetrics);
  const [metricName, setMetricName] = useState("");
  const [metricAssignee, setMetricAssignee] = useState(props.members[0]?.user_id || "");
  const [metricUnit, setMetricUnit] = useState("");
  const [metricTarget, setMetricTarget] = useState("");
  const [metricPeriod, setMetricPeriod] = useState<"week" | "month" | "quarter">("month");
  const [metricMessage, setMetricMessage] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(props.avatarUrl);
  const [avatarColor, setAvatarColor] = useState(props.avatarColor);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [databases, setDatabases] = useState(props.initialDatabases);
  const [databaseName, setDatabaseName] = useState("");
  const [databaseColumns, setDatabaseColumns] = useState("");
  const [databaseMessage, setDatabaseMessage] = useState("");
  const [recordDrafts, setRecordDrafts] = useState<Record<string, Record<string, string>>>({});
  const [recordLinks, setRecordLinks] = useState<Record<string, string>>({});
  const [recordFiles, setRecordFiles] = useState<Record<string, File | null>>({});
  const [databaseBusy, setDatabaseBusy] = useState("");
  const ownTasks = useMemo(() => tasks.filter((task) => task.owner_id === props.userId), [tasks, props.userId]);
  const canManage = props.role === "owner" || props.role === "manager";
  const visibleResponsibilities = canManage
    ? responsibilities
    : responsibilities.filter((item) => item.assignee_id === props.userId);

  function memberProfile(member?: Member) {
    if (!member) return null;
    return Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
  }

  function memberName(userId: string) {
    const profile = memberProfile(members.find((member) => member.user_id === userId));
    return profile?.full_name || profile?.email || "Сотрудник";
  }

  function updateMemberProfile(userId: string, patch: Partial<MemberProfile>) {
    setMembers((items) => items.map((member) => {
      if (member.user_id !== userId) return member;
      const current = memberProfile(member) || {};
      return { ...member, profiles: { ...current, ...patch } };
    }));
  }

  function updateMemberWorkTime(userId: string, workStartTime: string) {
    setMembers((items) => items.map((member) => member.user_id === userId
      ? { ...member, work_start_time: workStartTime || null }
      : member));
  }

  async function saveMemberProfile(userId: string) {
    const profile = memberProfile(members.find((member) => member.user_id === userId));
    if (!profile) return;
    setProfileMessage("");
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({
      employee_description: profile.employee_description?.trim() || "",
      birth_date: profile.birth_date || null,
    }).eq("id", userId);
    const member = members.find((item) => item.user_id === userId);
    const { error: membershipError } = await supabase.from("organization_members").update({
      work_start_time: member?.work_start_time || null,
    }).eq("organization_id", props.organizationId).eq("user_id", userId);
    setProfileMessage(error || membershipError ? "Не удалось сохранить карточку сотрудника." : `Карточка «${memberName(userId)}» сохранена.`);
  }

  async function setNotificationContact(userId: string) {
    setProfileMessage("");
    const { error } = await createClient().rpc("set_notification_contact", { target_user_id: userId });
    if (error) {
      setProfileMessage("Не удалось назначить ответственного. Сначала установите обновление базы.");
      return;
    }
    setMembers((items) => items.map((member) => ({ ...member, is_notification_contact: member.user_id === userId })));
    setProfileMessage(`Ответственный за уведомления — ${memberName(userId)}.`);
  }

  const birthdayNotifications = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return members.flatMap((member) => {
      const profile = memberProfile(member);
      if (!profile?.birth_date) return [];
      const birth = new Date(`${profile.birth_date}T00:00:00`);
      let next = new Date(start.getFullYear(), birth.getMonth(), birth.getDate());
      if (next < start) next = new Date(start.getFullYear() + 1, birth.getMonth(), birth.getDate());
      const days = Math.round((next.getTime() - start.getTime()) / 86400000);
      return days <= 30 ? [{ userId: member.user_id, name: memberName(member.user_id), date: next, days }] : [];
    }).sort((a, b) => a.days - b.days);
  }, [members]);

  const isNotificationContact = members.some((member) => member.user_id === props.userId && member.is_notification_contact);
  const personalNotifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return ownTasks.filter((task) => task.status !== "done" && task.due_date).map((task) => {
      const deadline = new Date(`${task.due_date}T00:00:00`);
      const days = Math.round((deadline.getTime() - today.getTime()) / 86400000);
      return { task, days };
    }).filter((item) => item.days <= 3).sort((a, b) => a.days - b.days);
  }, [ownTasks]);

  function taskStats(userId: string) {
    const items = tasks.filter((task) => task.owner_id === userId);
    const done = items.filter((task) => task.status === "done").length;
    const active = items.length - done;
    const overdue = items.filter((task) => task.status !== "done" && task.due_date && new Date(`${task.due_date}T23:59:59`) < new Date()).length;
    return { total: items.length, done, active, overdue, percent: items.length ? Math.round(done / items.length * 100) : 0 };
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("tasks").insert({
      organization_id: props.organizationId, owner_id: props.userId, title: title.trim(),
      status: "planned", priority: "medium", due_date: dueDate || null,
    }).select().single();
    if (!error && data) {
      setTasks((items) => [data, ...items]);
      setTitle("");
      setDueDate("");
    }
    setBusy(false);
  }

  async function toggle(task: Task) {
    const status = task.status === "done" ? "planned" : "done";
    const supabase = createClient();
    const { error } = await supabase.from("tasks").update({
      status, completed_at: status === "done" ? new Date().toISOString() : null,
    }).eq("id", task.id);
    if (!error) setTasks((items) => items.map((item) => item.id === task.id ? { ...item, status } : item));
  }

  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/auth";
  }

  async function saveAvatarColor(color: string) {
    setAvatarColor(color);
    setAvatarMessage("");
    const { error } = await createClient().from("profiles").update({ avatar_color: color }).eq("id", props.userId);
    setAvatarMessage(error ? "Не удалось сохранить цвет." : "Цвет профиля сохранён.");
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setAvatarMessage("Выберите изображение размером до 2 МБ.");
      return;
    }
    setAvatarBusy(true);
    setAvatarMessage("");
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${props.userId}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) {
      setAvatarMessage("Не удалось загрузить фотографию.");
      setAvatarBusy(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", props.userId);
    if (!error) {
      setAvatarUrl(data.publicUrl);
      updateMemberProfile(props.userId, { avatar_url: data.publicUrl });
    }
    setAvatarMessage(error ? "Не удалось сохранить фотографию." : "Фотография профиля обновлена.");
    setAvatarBusy(false);
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setAvatarMessage("");
    const { error } = await createClient().from("profiles").update({ avatar_url: null }).eq("id", props.userId);
    if (!error) {
      setAvatarUrl("");
      updateMemberProfile(props.userId, { avatar_url: null });
    }
    setAvatarMessage(error ? "Не удалось убрать фотографию." : "Фото убрано — снова используется цветной аватар.");
    setAvatarBusy(false);
  }

  function Avatar({ profile, className = "" }: { profile?: MemberProfile | null; className?: string }) {
    const color = profile?.avatar_color || "#7655d8";
    const url = profile?.avatar_url;
    return <span className={`avatar ${className}`} style={{ backgroundColor: color }}>
      {url ? <img src={url} alt="" /> : (profile?.full_name?.slice(0, 1) || "•")}
    </span>;
  }

  async function createPersonalDatabase(event: React.FormEvent) {
    event.preventDefault();
    const columns = databaseColumns.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12);
    if (!databaseName.trim() || !columns.length) return;
    setDatabaseMessage("");
    const { data, error } = await createClient().from("personal_databases").insert({
      owner_id: props.userId,
      name: databaseName.trim(),
      columns,
      records: [],
    }).select("id,name,columns,records,created_at").single();
    if (error || !data) {
      setDatabaseMessage("Не удалось создать базу.");
      return;
    }
    setDatabases((items) => [data, ...items]);
    setDatabaseName("");
    setDatabaseColumns("");
    setDatabaseMessage("Личная база создана.");
  }

  async function addDatabaseRecord(database: PersonalDatabase) {
    const draft = recordDrafts[database.id] || {};
    const link = recordLinks[database.id]?.trim() || "";
    const file = recordFiles[database.id];
    if (!database.columns.some((column) => draft[column]?.trim()) && !link && !file) return;
    if (file && file.size > 10 * 1024 * 1024) {
      setDatabaseMessage("Размер файла не должен превышать 10 МБ.");
      return;
    }
    setDatabaseBusy(database.id);
    let filePath = "";
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Zа-яА-Я0-9._-]/g, "-");
      filePath = `${props.userId}/${database.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await createClient().storage.from("personal-files").upload(filePath, file);
      if (uploadError) {
        setDatabaseMessage("Не удалось загрузить файл.");
        setDatabaseBusy("");
        return;
      }
    }
    const record = {
      ...Object.fromEntries(database.columns.map((column) => [column, draft[column]?.trim() || ""])),
      _link: link,
      _file_path: filePath,
      _file_name: file?.name || "",
    };
    const records = [...database.records, record];
    const { error } = await createClient().from("personal_databases").update({ records }).eq("id", database.id);
    if (!error) {
      setDatabases((items) => items.map((item) => item.id === database.id ? { ...item, records } : item));
      setRecordDrafts((items) => ({ ...items, [database.id]: {} }));
      setRecordLinks((items) => ({ ...items, [database.id]: "" }));
      setRecordFiles((items) => ({ ...items, [database.id]: null }));
    }
    setDatabaseBusy("");
  }

  async function openPersonalFile(path: string) {
    const { data, error } = await createClient().storage.from("personal-files").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      setDatabaseMessage("Не удалось открыть файл.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removePersonalDatabase(database: PersonalDatabase) {
    if (!window.confirm(`Удалить личную базу «${database.name}»?`)) return;
    const { error } = await createClient().from("personal_databases").delete().eq("id", database.id);
    if (!error) setDatabases((items) => items.filter((item) => item.id !== database.id));
  }

  function invitationLink(token: string) {
    return `${window.location.origin}/auth?invite=${token}`;
  }

  async function createInvitation(event: React.FormEvent) {
    event.preventDefault();
    setInviteBusy(true);
    setInviteMessage("");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_invitation_with_position", {
      invite_email: inviteEmail.trim(), invite_role: inviteRole,
      invite_position_id: invitePositionId || null,
    });
    const created = data?.[0];
    if (error || !created) {
      setInviteMessage("Не удалось создать приглашение. Сначала установите обновление базы.");
    } else {
      const item: Invitation = {
        id: created.token, email: inviteEmail.trim().toLowerCase(), role: inviteRole,
        position_id: invitePositionId || null,
        token: created.token, expires_at: created.expires_at, accepted_at: null,
      };
      setInvitations((items) => [item, ...items.filter((old) => old.email !== item.email)]);
      setInviteEmail("");
      await navigator.clipboard.writeText(invitationLink(created.token));
      setInviteMessage("Ссылка создана и скопирована.");
    }
    setInviteBusy(false);
  }

  async function addPosition(event: React.FormEvent) {
    event.preventDefault();
    const name = newPosition.trim();
    if (!name) return;
    setPositionMessage("");
    const supabase = createClient();
    const { data, error } = await supabase.from("positions").insert({
      organization_id: props.organizationId, name,
    }).select("id,name,parent_position_id,purpose").single();
    if (error || !data) {
      setPositionMessage(error?.code === "23505" ? "Такая должность уже есть." : "Не удалось добавить должность.");
      return;
    }
    setPositions((items) => [...items, data].sort((a, b) => a.name.localeCompare(b.name, "ru")));
    setNewPosition("");
    setPositionMessage("Должность добавлена.");
  }

  async function changeMemberPosition(userId: string, positionId: string) {
    const position = positions.find((item) => item.id === positionId);
    const supabase = createClient();
    const { error } = await supabase.from("organization_members").update({
      position_id: positionId || null, job_title: position?.name || null,
    }).eq("organization_id", props.organizationId).eq("user_id", userId);
    if (!error) {
      setMembers((items) => items.map((member) => member.user_id === userId
        ? { ...member, position_id: positionId || null, job_title: position?.name || null }
        : member));
    }
  }

  async function changePositionPurpose(positionId: string, purpose: string) {
    setPositions((items) => items.map((position) => position.id === positionId ? { ...position, purpose } : position));
  }

  function changePositionName(positionId: string, name: string) {
    setPositions((items) => items.map((position) => position.id === positionId ? { ...position, name } : position));
  }

  async function savePositionPurpose(positionId: string) {
    const position = positions.find((item) => item.id === positionId);
    if (!position) return;
    const supabase = createClient();
    const { error } = await supabase.from("positions").update({
      name: position.name.trim(), purpose: position.purpose.trim(),
    }).eq("id", positionId);
    if (!error) {
      await supabase.from("organization_members").update({ job_title: position.name.trim() })
        .eq("organization_id", props.organizationId).eq("position_id", positionId);
      setMembers((items) => items.map((member) => member.position_id === positionId ? { ...member, job_title: position.name.trim() } : member));
    }
    setPositionMessage(error ? "Не удалось сохранить должность." : `Должность «${position.name}» обновлена.`);
  }

  async function removePosition(positionId: string) {
    const position = positions.find((item) => item.id === positionId);
    if (!position || !window.confirm(`Удалить должность «${position.name}»?`)) return;
    const { error } = await createClient().from("positions").delete().eq("id", positionId);
    if (error) {
      setPositionMessage("Нельзя удалить должность, пока к ней привязаны сотрудники или приглашения.");
      return;
    }
    setPositions((items) => items.filter((item) => item.id !== positionId).map((item) => item.parent_position_id === positionId ? { ...item, parent_position_id: null } : item));
    setPositionMessage("Должность удалена.");
  }

  async function installStructureTemplate() {
    setPositionMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("install_default_org_structure");
    if (error) {
      setPositionMessage("Не удалось установить шаблон структуры.");
      return;
    }
    const { data } = await supabase.from("positions").select("id,name,parent_position_id,purpose")
      .eq("organization_id", props.organizationId).order("name");
    if (data) setPositions(data);
    setPositionMessage("Готовая «Структура Организации» добавлена.");
  }

  async function removeMember(userId: string) {
    const name = memberName(userId);
    if (!window.confirm(`Удалить сотрудника «${name}» из компании? Его аккаунт и история задач сохранятся.`)) return;
    const { error } = await createClient().rpc("remove_organization_member", { target_user_id: userId });
    if (error) {
      setProfileMessage("Не удалось удалить сотрудника. Владельца компании удалить нельзя.");
      return;
    }
    setMembers((items) => items.filter((item) => item.user_id !== userId));
    setProfileMessage(`Сотрудник «${name}» удалён из компании.`);
  }

  async function addMetric(event: React.FormEvent) {
    event.preventDefault();
    if (!metricName.trim() || !metricTarget) return;
    setMetricMessage("");
    const { data, error } = await createClient().from("kpi_metrics").insert({
      organization_id: props.organizationId,
      assignee_id: metricAssignee || null,
      name: metricName.trim(),
      unit: metricUnit.trim(),
      target_value: Number(metricTarget),
      period: metricPeriod,
      created_by: props.userId,
    }).select("id,assignee_id,name,description,unit,target_value,current_value,period,is_active").single();
    if (error || !data) {
      setMetricMessage("Не удалось создать KPI.");
      return;
    }
    setMetrics((items) => [data as KpiMetric, ...items]);
    setMetricName(""); setMetricUnit(""); setMetricTarget("");
    setMetricMessage("Метрика KPI создана.");
  }

  async function updateMetricValue(id: string, value: number) {
    const { error } = await createClient().from("kpi_metrics").update({ current_value: value }).eq("id", id);
    if (!error) setMetrics((items) => items.map((item) => item.id === id ? { ...item, current_value: value } : item));
  }

  async function removeMetric(id: string) {
    const { error } = await createClient().from("kpi_metrics").update({ is_active: false }).eq("id", id);
    if (!error) setMetrics((items) => items.filter((item) => item.id !== id));
  }

  async function addResponsibility(event: React.FormEvent) {
    event.preventDefault();
    if (!responsibilityAssignee || !responsibilityTitle.trim()) return;
    setResponsibilityMessage("");
    const supabase = createClient();
    const { data, error } = await supabase.from("responsibilities").insert({
      organization_id: props.organizationId,
      assignee_id: responsibilityAssignee,
      title: responsibilityTitle.trim(),
      expected_result: responsibilityResult.trim(),
      created_by: props.userId,
    }).select("id,assignee_id,title,expected_result,is_active").single();
    if (error || !data) {
      setResponsibilityMessage("Не удалось сохранить обязанность.");
      return;
    }
    setResponsibilities((items) => [...items, data]);
    setResponsibilityTitle("");
    setResponsibilityResult("");
    setResponsibilityMessage("Обязанность добавлена.");
  }

  async function removeResponsibility(id: string) {
    const { error } = await createClient().from("responsibilities").update({ is_active: false }).eq("id", id);
    if (!error) setResponsibilities((items) => items.filter((item) => item.id !== id));
  }

  async function copyInvitation(token: string) {
    await navigator.clipboard.writeText(invitationLink(token));
    setInviteMessage("Ссылка скопирована.");
  }

  const roleName = props.role === "owner" ? "Владелец" : props.role === "manager" ? "Руководитель" : "Сотрудник";
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Неделька</span></div>
        <div className="org-name"><small>ОРГАНИЗАЦИЯ</small><strong>{props.organizationName}</strong></div>
        <nav>
          <button className={tab === "tasks" ? "active" : ""} onClick={() => setTab("tasks")}>✓ Мои задачи <b>{ownTasks.filter((task) => task.status !== "done").length}</b></button>
          <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}>▥ Статистика</button>
          <button className={tab === "duties" ? "active" : ""} onClick={() => setTab("duties")}>☷ Обязанности</button>
          {canManage && <button className={tab === "structure" ? "active" : ""} onClick={() => setTab("structure")}>⌘ Структура</button>}
          <button className={tab === "kpi" ? "active" : ""} onClick={() => setTab("kpi")}>↗ KPI</button>
          <button className={tab === "database" ? "active" : ""} onClick={() => setTab("database")}>▦ Мои базы</button>
          {canManage && <button className={tab === "team" ? "active" : ""} onClick={() => setTab("team")}>◎ Команда <b>{members.length}</b></button>}
        </nav>
        <div className="profile">
          <button className="profile-main" onClick={() => setProfileOpen(true)} aria-label="Открыть профиль">
          <Avatar profile={{ full_name: props.name, avatar_url: avatarUrl, avatar_color: avatarColor }} />
          <div><strong>{props.name || props.email}</strong><small>Профиль · {roleName}</small></div>
          </button>
          <button onClick={signOut}>Выйти →</button>
        </div>
      </header>

      {profileOpen && <div className="profile-dialog-backdrop" onMouseDown={() => setProfileOpen(false)}>
        <section className="profile-dialog" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog">
          <button className="profile-close" onClick={() => setProfileOpen(false)} aria-label="Закрыть">×</button>
          <p className="eyebrow">МОЙ ПРОФИЛЬ</p>
          <h2>Аватар и цвет</h2>
          <div className="avatar-preview"><Avatar profile={{ full_name: props.name, avatar_url: avatarUrl, avatar_color: avatarColor }} /></div>
          <label className="avatar-upload">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} disabled={avatarBusy} />
            {avatarBusy ? "Сохраняем…" : avatarUrl ? "Сменить фотографию" : "Выбрать фотографию"}
          </label>
          {avatarUrl && <button className="avatar-remove" onClick={removeAvatar} disabled={avatarBusy}>Убрать фото и вернуть цветной аватар</button>}
          <div className="color-picker">
            <span>Цвет профиля</span>
            <div>{["#7655d8", "#a8d957", "#ef8d72", "#56b8a7", "#e4a63d", "#b866c8"].map((color) => (
              <button key={color} style={{ backgroundColor: color }} className={avatarColor === color ? "selected" : ""} onClick={() => saveAvatarColor(color)} aria-label={`Выбрать цвет ${color}`} />
            ))}</div>
          </div>
          {avatarMessage && <p className="avatar-message">{avatarMessage}</p>}
          <small>Подойдут JPG, PNG или WebP до 2 МБ.</small>
        </section>
      </div>}

      <section className="workspace">
        {tab === "tasks" ? (
          <div className="content">
            {isNotificationContact && <section className="birthday-notifications">
              <div><span className="notification-icon">✦</span><div><strong>Уведомления о сотрудниках</strong><small>Вы назначены ответственным лицом</small></div></div>
              {birthdayNotifications.length ? birthdayNotifications.map((item) => (
                <article key={item.userId}><b>{item.name}</b><span>{item.days === 0 ? "День рождения сегодня" : item.days === 1 ? "День рождения завтра" : `Через ${item.days} дн.`}</span><time>{item.date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</time></article>
              )) : <p>В ближайшие 30 дней дней рождения нет.</p>}
            </section>}
            {!!personalNotifications.length && <section className="personal-notifications">
              <div><span>🔔</span><div><strong>Личные уведомления</strong><small>Только ваши задачи и сроки</small></div></div>
              {personalNotifications.map(({ task, days }) => <article key={task.id}>
                <b>{task.title}</b>
                <span className={days < 0 ? "overdue" : ""}>{days < 0 ? `Просрочено на ${Math.abs(days)} дн.` : days === 0 ? "Срок сегодня" : days === 1 ? "Срок завтра" : `Осталось ${days} дн.`}</span>
              </article>)}
            </section>}
            <p className="eyebrow">МОЁ ПРОСТРАНСТВО</p>
            <h1>Добрый день{props.name ? `, ${props.name.split(" ")[0]}` : ""}!</h1>
            <p className="lead">Здесь только ваши задачи. Начните с первой.</p>
            <form className="quick-add" onSubmit={addTask}>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Что нужно сделать?" />
              <label className="task-deadline"><span>Срок</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
              <button className="primary" disabled={busy}>＋ Добавить</button>
            </form>
            <div className="list-heading"><h2>Мои задачи</h2><span>{ownTasks.length}</span></div>
            <div className="task-list">
              {ownTasks.map((task) => (
                <article className={task.status === "done" ? "task done" : "task"} key={task.id}>
                  <button className="check" onClick={() => toggle(task)}>{task.status === "done" ? "✓" : ""}</button>
                  <strong>{task.title}</strong>
                  <div className="task-meta"><span>{task.priority === "high" ? "Высокий" : task.priority === "low" ? "Низкий" : "Средний"}</span>{task.due_date && <time>{new Date(`${task.due_date}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</time>}</div>
                </article>
              ))}
              {!ownTasks.length && <div className="empty"><b>Пока нет задач</b><p>Добавьте первую задачу — пространство создано специально для вас.</p></div>}
            </div>
          </div>
        ) : tab === "stats" ? (
          <div className="content">
            <p className="eyebrow">{canManage ? "КАРТИНА ПО КОМАНДЕ" : "МОИ РЕЗУЛЬТАТЫ"}</p>
            <h1>Статистика</h1>
            <p className="lead">{canManage ? "Понятная сводка по задачам каждого сотрудника." : "Ваш прогресс без сложных отчётов и лишних показателей."}</p>
            <div className="stat-summary">
              {(() => {
                const stats = taskStats(props.userId);
                return <>
                  <article><small>ВСЕГО ЗАДАЧ</small><strong>{stats.total}</strong></article>
                  <article><small>ВЫПОЛНЕНО</small><strong>{stats.done}</strong></article>
                  <article><small>В РАБОТЕ</small><strong>{stats.active}</strong></article>
                  <article className={stats.overdue ? "warning" : ""}><small>ПРОСРОЧЕНО</small><strong>{stats.overdue}</strong></article>
                  <article className="accent"><small>ГОТОВО</small><strong>{stats.percent}%</strong></article>
                </>;
              })()}
            </div>
            {canManage && <>
              <div className="list-heading"><h2>Команда</h2><span>{members.length}</span></div>
              <div className="team-stats">
                {members.map((member) => {
                  const stats = taskStats(member.user_id);
                  return <article key={member.user_id}>
                    <div><strong>{memberName(member.user_id)}</strong><small>{member.job_title || (member.role === "owner" ? "Владелец" : member.role === "manager" ? "Руководитель" : "Сотрудник")}</small></div>
                    <span>{stats.done} из {stats.total}</span>
                    <div className="progress"><i style={{ width: `${stats.percent}%` }} /></div>
                    <b>{stats.percent}%</b>
                  </article>;
                })}
              </div>
            </>}
          </div>
        ) : tab === "duties" ? (
          <div className="content">
            <p className="eyebrow">РОЛИ И ОЖИДАНИЯ</p>
            <h1>Обязанности</h1>
            <p className="lead">{canManage ? "Зафиксируйте, за что отвечает каждый сотрудник и какой результат от него ожидается." : "Здесь всегда видно, за что вы отвечаете и какого результата от вас ждут."}</p>
            {canManage && <form className="responsibility-form" onSubmit={addResponsibility}>
              <label>Сотрудник<select value={responsibilityAssignee} onChange={(event) => setResponsibilityAssignee(event.target.value)}>{members.map((member) => <option key={member.user_id} value={member.user_id}>{memberName(member.user_id)}</option>)}</select></label>
              <label>Обязанность<input required value={responsibilityTitle} onChange={(event) => setResponsibilityTitle(event.target.value)} placeholder="Например, отвечать на заявки клиентов" /></label>
              <label>Ожидаемый результат<textarea value={responsibilityResult} onChange={(event) => setResponsibilityResult(event.target.value)} placeholder="Например, ответ в течение 15 минут" /></label>
              <button className="primary">＋ Добавить обязанность</button>
              {responsibilityMessage && <small className={responsibilityMessage.startsWith("Не удалось") ? "form-error" : "form-success"}>{responsibilityMessage}</small>}
            </form>}
            <div className="responsibility-list">
              {visibleResponsibilities.map((item) => <article key={item.id}>
                <div><small>{memberName(item.assignee_id)}</small><strong>{item.title}</strong>{item.expected_result && <p><b>Результат:</b> {item.expected_result}</p>}</div>
                {canManage && <button onClick={() => removeResponsibility(item.id)}>Убрать</button>}
              </article>)}
              {!visibleResponsibilities.length && <div className="empty"><b>Обязанности ещё не добавлены</b><p>{canManage ? "Добавьте первую обязанность сотрудника." : "Руководитель пока не заполнил этот раздел."}</p></div>}
            </div>
          </div>
        ) : tab === "structure" && canManage ? (
          <div className="content structure-content">
            <p className="eyebrow">КТО ЗА ЧТО ОТВЕЧАЕТ</p>
            <h1>Структура Организации</h1>
            <p className="lead">Список должностей компании и главный результат, за который отвечает каждая из них.</p>
            <section className="structure-editor">
              <div className="structure-editor-head"><div><h2>Должности и цели</h2><p>Укажите понятное название и кратко опишите главную цель каждой должности.</p></div><button className="template-button" onClick={installStructureTemplate}>＋ Добавить готовые должности</button></div>
              {positions.map((position) => <article key={position.id}>
                <label>Название должности<input value={position.name} onChange={(event) => changePositionName(position.id, event.target.value)} /></label>
                <label>Цель должности<input value={position.purpose} onChange={(event) => changePositionPurpose(position.id, event.target.value)} placeholder="Какой главный результат даёт эта должность?" /></label>
                <div className="position-buttons"><button onClick={() => savePositionPurpose(position.id)}>Сохранить</button><button className="danger-button" onClick={() => removePosition(position.id)}>Удалить</button></div>
              </article>)}
              {!positions.length && <div className="empty"><b>Должностей пока нет</b><p>Добавьте должности в разделе «Команда» или воспользуйтесь готовым набором.</p></div>}
              {positionMessage && <small className={positionMessage.startsWith("Не удалось") ? "form-error" : "form-success"}>{positionMessage}</small>}
            </section>
          </div>
        ) : tab === "kpi" ? (
          <div className="content">
            <p className="eyebrow">ИЗМЕРИМЫЕ РЕЗУЛЬТАТЫ</p>
            <h1>Метрики KPI</h1>
            <p className="lead">Создавайте понятные показатели для команды и отслеживайте прогресс к цели.</p>
            {canManage && <form className="kpi-form" onSubmit={addMetric}>
              <label>Название KPI<input required value={metricName} onChange={(event) => setMetricName(event.target.value)} placeholder="Например, выручка" /></label>
              <label>Сотрудник<select value={metricAssignee} onChange={(event) => setMetricAssignee(event.target.value)}><option value="">Вся команда</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{memberName(member.user_id)}</option>)}</select></label>
              <label>Цель<input required type="number" step="any" value={metricTarget} onChange={(event) => setMetricTarget(event.target.value)} placeholder="100" /></label>
              <label>Единица<input value={metricUnit} onChange={(event) => setMetricUnit(event.target.value)} placeholder="₽, %, шт." /></label>
              <label>Период<select value={metricPeriod} onChange={(event) => setMetricPeriod(event.target.value as "week" | "month" | "quarter")}><option value="week">Неделя</option><option value="month">Месяц</option><option value="quarter">Квартал</option></select></label>
              <button className="primary">＋ Создать KPI</button>
              {metricMessage && <small className={metricMessage.startsWith("Не удалось") ? "form-error" : "form-success"}>{metricMessage}</small>}
            </form>}
            <div className="kpi-grid">
              {metrics.map((metric) => {
                const percent = metric.target_value ? Math.max(0, Math.round(metric.current_value / metric.target_value * 100)) : 0;
                return <article key={metric.id}>
                  <div className="kpi-title"><div><small>{metric.assignee_id ? memberName(metric.assignee_id) : "Вся команда"} · {metric.period === "week" ? "Неделя" : metric.period === "quarter" ? "Квартал" : "Месяц"}</small><strong>{metric.name}</strong></div>{canManage && <button onClick={() => removeMetric(metric.id)}>Удалить</button>}</div>
                  <div className="kpi-values"><b>{metric.current_value} {metric.unit}</b><span>цель {metric.target_value} {metric.unit}</span></div>
                  <div className="kpi-progress"><i style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                  <div className="kpi-footer"><strong>{percent}%</strong>{canManage && <label>Текущее значение<input type="number" step="any" value={metric.current_value} onChange={(event) => updateMetricValue(metric.id, Number(event.target.value))} /></label>}</div>
                </article>;
              })}
              {!metrics.length && <div className="empty"><b>KPI пока нет</b><p>Руководитель может создать первую измеримую цель.</p></div>}
            </div>
          </div>
        ) : tab === "database" ? (
          <div className="content database-content">
            <p className="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</p>
            <h1>Мои базы</h1>
            <p className="lead">Создавайте собственные таблицы для контактов, идей, клиентов или любых рабочих записей. Их видите только вы.</p>
            <form className="database-create" onSubmit={createPersonalDatabase}>
              <label>Название базы<input required value={databaseName} onChange={(event) => setDatabaseName(event.target.value)} placeholder="Например, Клиенты" /></label>
              <label>Колонки через запятую<input required value={databaseColumns} onChange={(event) => setDatabaseColumns(event.target.value)} placeholder="Имя, Телефон, Статус" /></label>
              <button className="primary">＋ Создать базу</button>
              {databaseMessage && <small>{databaseMessage}</small>}
            </form>
            <div className="database-list">
              {databases.map((database) => <section className="database-card" key={database.id}>
                <header><div><small>ЛИЧНАЯ БАЗА</small><h2>{database.name}</h2></div><button onClick={() => removePersonalDatabase(database)}>Удалить</button></header>
                <div className="database-table-wrap"><table><thead><tr>{database.columns.map((column) => <th key={column}>{column}</th>)}<th>Ссылка</th><th>Файл</th></tr></thead>
                  <tbody>{database.records.map((record, index) => <tr key={index}>{database.columns.map((column) => <td key={column}>{record[column] || "—"}</td>)}<td>{record._link ? <a href={record._link} target="_blank" rel="noreferrer">Открыть ↗</a> : "—"}</td><td>{record._file_path ? <button className="database-file-link" onClick={() => openPersonalFile(record._file_path)}>📎 {record._file_name || "Файл"}</button> : "—"}</td></tr>)}
                    <tr className="database-new-row">{database.columns.map((column) => <td key={column}><input value={recordDrafts[database.id]?.[column] || ""} onChange={(event) => setRecordDrafts((items) => ({ ...items, [database.id]: { ...(items[database.id] || {}), [column]: event.target.value } }))} placeholder="Введите значение" /></td>)}<td><input type="url" value={recordLinks[database.id] || ""} onChange={(event) => setRecordLinks((items) => ({ ...items, [database.id]: event.target.value }))} placeholder="https://…" /></td><td><label className="database-file-picker"><input type="file" onChange={(event) => setRecordFiles((items) => ({ ...items, [database.id]: event.target.files?.[0] || null }))} />{recordFiles[database.id]?.name || "＋ Выбрать файл"}</label></td></tr>
                  </tbody></table></div>
                <button className="database-add-row" disabled={databaseBusy === database.id} onClick={() => addDatabaseRecord(database)}>{databaseBusy === database.id ? "Сохраняем…" : "＋ Добавить строку"}</button>
              </section>)}
              {!databases.length && <div className="empty"><b>Личных баз пока нет</b><p>Создайте первую таблицу — например, список клиентов или библиотеку идей.</p></div>}
            </div>
          </div>
        ) : (
          <div className="content">
            <p className="eyebrow">УПРАВЛЕНИЕ ОРГАНИЗАЦИЕЙ</p>
            <h1>Команда</h1>
            <p className="lead">Приглашайте сотрудников и других руководителей по персональной ссылке.</p>
            <section className="positions-card">
              <div><h2>Должности</h2><p>Создайте список должностей вашей команды.</p></div>
              <form onSubmit={addPosition}>
                <input value={newPosition} onChange={(event) => setNewPosition(event.target.value)} placeholder="Например, дизайнер" />
                <button className="primary">＋ Добавить</button>
              </form>
              {!!positions.length && <div className="position-chips">{positions.map((position) => <span key={position.id}>{position.name}</span>)}</div>}
              {positionMessage && <small className={positionMessage.startsWith("Не удалось") || positionMessage.includes("уже") ? "form-error" : "form-success"}>{positionMessage}</small>}
            </section>
            <form className="invite-form" onSubmit={createInvitation}>
              <label>Почта сотрудника<input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@company.ru" /></label>
              <label>Роль<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "manager" | "employee")}><option value="employee">Сотрудник</option><option value="manager">Руководитель</option></select></label>
              <label>Должность<select value={invitePositionId} onChange={(event) => setInvitePositionId(event.target.value)}><option value="">Не выбрана</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}</select></label>
              <button className="primary" disabled={inviteBusy}>{inviteBusy ? "Создаём…" : "＋ Создать ссылку"}</button>
            </form>
            {inviteMessage && <div className={inviteMessage.startsWith("Не удалось") ? "notice" : "notice success"}>{inviteMessage}</div>}
            {!!invitations.length && <div className="pending-list">
              <div className="list-heading"><h2>Ожидают регистрации</h2><span>{invitations.length}</span></div>
              {invitations.map((invitation) => {
                const position = positions.find((item) => item.id === invitation.position_id);
                return <article key={invitation.token}><div><strong>{invitation.email}</strong><small>{invitation.role === "manager" ? "Руководитель" : "Сотрудник"}{position ? ` · ${position.name}` : ""} · ссылка действует 7 дней</small></div><button onClick={() => copyInvitation(invitation.token)}>Копировать ссылку</button></article>;
              })}
            </div>}
            <div className="list-heading"><h2>Участники</h2><span>{members.length}</span></div>
            <section className="notification-contact-card">
              <div><h2>Ответственный за уведомления</h2><p>Этот человек увидит напоминания о ближайших днях рождения.</p></div>
              <select value={members.find((member) => member.is_notification_contact)?.user_id || ""} onChange={(event) => event.target.value && setNotificationContact(event.target.value)}>
                <option value="">Выберите сотрудника</option>
                {members.map((member) => <option key={member.user_id} value={member.user_id}>{memberName(member.user_id)}</option>)}
              </select>
            </section>
            {profileMessage && <div className={profileMessage.startsWith("Не удалось") ? "notice" : "notice success"}>{profileMessage}</div>}
            <div className="member-list">
              {members.map((member) => {
                const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
                return <article className="member-card" key={member.user_id}>
                  <Avatar profile={profile} />
                  <div className="member-identity"><strong>{profile?.full_name || profile?.email}</strong><small>{member.role === "owner" ? "Владелец" : member.role === "manager" ? "Руководитель" : "Сотрудник"}{member.job_title ? ` · ${member.job_title}` : ""}{member.is_notification_contact ? " · Ответственный за уведомления" : ""}</small></div>
                  <label className="member-position">Должность<select value={member.position_id || ""} onChange={(event) => changeMemberPosition(member.user_id, event.target.value)}><option value="">Не выбрана</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}</select></label>
                  <div className="member-details">
                    <label>Дата рождения<input type="date" value={profile?.birth_date || ""} onChange={(event) => updateMemberProfile(member.user_id, { birth_date: event.target.value || null })} /></label>
                    <label>Начало рабочего дня<input type="time" value={member.work_start_time?.slice(0, 5) || ""} onChange={(event) => updateMemberWorkTime(member.user_id, event.target.value)} /></label>
                    <label>Описание сотрудника<textarea value={profile?.employee_description || ""} onChange={(event) => updateMemberProfile(member.user_id, { employee_description: event.target.value })} placeholder="Сильные стороны, опыт, важные особенности работы…" /></label>
                    <div className="member-buttons"><button onClick={() => saveMemberProfile(member.user_id)}>Сохранить</button>{member.role !== "owner" && <button className="remove-member" onClick={() => removeMember(member.user_id)}>Удалить из компании</button>}</div>
                  </div>
                </article>;
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
