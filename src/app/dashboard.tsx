"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Task = { id: string; owner_id: string; title: string; status: string; priority: string; due_date: string | null };
type Member = { user_id: string; role: string; job_title: string | null; position_id: string | null; profiles: { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null };
type Invitation = { id: string; email: string; role: string; position_id: string | null; token: string; expires_at: string; accepted_at: string | null };
type Position = { id: string; name: string };

export default function Dashboard(props: {
  userId: string; name: string; email: string; organizationId: string; organizationName: string;
  role: "owner" | "manager" | "employee"; initialTasks: Task[]; members: Member[];
  initialInvitations: Invitation[]; initialPositions: Position[];
}) {
  const [tasks, setTasks] = useState(props.initialTasks);
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<"tasks" | "team">("tasks");
  const [busy, setBusy] = useState(false);
  const [invitations, setInvitations] = useState(props.initialInvitations);
  const [members, setMembers] = useState(props.members);
  const [positions, setPositions] = useState(props.initialPositions);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "employee">("employee");
  const [invitePositionId, setInvitePositionId] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [positionMessage, setPositionMessage] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const ownTasks = useMemo(() => tasks.filter((task) => task.owner_id === props.userId), [tasks, props.userId]);
  const canManage = props.role === "owner" || props.role === "manager";

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("tasks").insert({
      organization_id: props.organizationId, owner_id: props.userId, title: title.trim(),
      status: "planned", priority: "medium",
    }).select().single();
    if (!error && data) {
      setTasks((items) => [data, ...items]);
      setTitle("");
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
    }).select("id,name").single();
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

  async function copyInvitation(token: string) {
    await navigator.clipboard.writeText(invitationLink(token));
    setInviteMessage("Ссылка скопирована.");
  }

  const roleName = props.role === "owner" ? "Владелец" : props.role === "manager" ? "Руководитель" : "Сотрудник";
  const initials = props.name.split(" ").map((part) => part[0]).slice(0, 2).join("") || "Я";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">▥</span>Неделька</div>
        <div className="org-name"><small>ОРГАНИЗАЦИЯ</small><strong>{props.organizationName}</strong></div>
        <nav>
          <button className={tab === "tasks" ? "active" : ""} onClick={() => setTab("tasks")}>✓ Мои задачи <b>{ownTasks.filter((task) => task.status !== "done").length}</b></button>
          {canManage && <button className={tab === "team" ? "active" : ""} onClick={() => setTab("team")}>◎ Команда <b>{members.length}</b></button>}
        </nav>
        <div className="profile">
          <span>{initials}</span>
          <div><strong>{props.name || props.email}</strong><small>{roleName}</small></div>
          <button onClick={signOut}>Выйти</button>
        </div>
      </header>

      <section className="workspace">
        {tab === "tasks" ? (
          <div className="content">
            <p className="eyebrow">МОЁ ПРОСТРАНСТВО</p>
            <h1>Добрый день{props.name ? `, ${props.name.split(" ")[0]}` : ""}!</h1>
            <p className="lead">Здесь только ваши задачи. Начните с первой.</p>
            <form className="quick-add" onSubmit={addTask}>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Что нужно сделать?" />
              <button className="primary" disabled={busy}>＋ Добавить</button>
            </form>
            <div className="list-heading"><h2>Мои задачи</h2><span>{ownTasks.length}</span></div>
            <div className="task-list">
              {ownTasks.map((task) => (
                <article className={task.status === "done" ? "task done" : "task"} key={task.id}>
                  <button className="check" onClick={() => toggle(task)}>{task.status === "done" ? "✓" : ""}</button>
                  <strong>{task.title}</strong>
                  <span>{task.priority === "high" ? "Высокий" : task.priority === "low" ? "Низкий" : "Средний"}</span>
                </article>
              ))}
              {!ownTasks.length && <div className="empty"><b>Пока нет задач</b><p>Добавьте первую задачу — пространство создано специально для вас.</p></div>}
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
            <div className="member-list">
              {members.map((member) => {
                const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
                return <article key={member.user_id}><span>{profile?.full_name?.slice(0, 1) || "•"}</span><div><strong>{profile?.full_name || profile?.email}</strong><small>{member.role === "owner" ? "Владелец" : member.role === "manager" ? "Руководитель" : "Сотрудник"}{member.job_title ? ` · ${member.job_title}` : ""}</small></div><label className="member-position">Должность<select value={member.position_id || ""} onChange={(event) => changeMemberPosition(member.user_id, event.target.value)}><option value="">Не выбрана</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}</select></label></article>;
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
