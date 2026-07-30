"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Task = { id: string; owner_id: string; title: string; status: string; priority: string; due_date: string | null; created_at?: string; completed_at?: string | null };
type MemberProfile = { full_name?: string; email?: string; employee_description?: string; birth_date?: string | null };
type Member = { user_id: string; role: string; job_title: string | null; position_id: string | null; is_notification_contact: boolean; profiles: MemberProfile | MemberProfile[] | null };
type Invitation = { id: string; email: string; role: string; position_id: string | null; token: string; expires_at: string; accepted_at: string | null };
type Position = { id: string; name: string; parent_position_id: string | null; purpose: string };
type Responsibility = { id: string; assignee_id: string; title: string; expected_result: string; is_active: boolean };

export default function Dashboard(props: {
  userId: string; name: string; email: string; organizationId: string; organizationName: string;
  role: "owner" | "manager" | "employee"; initialTasks: Task[]; members: Member[];
  initialInvitations: Invitation[]; initialPositions: Position[]; initialResponsibilities: Responsibility[];
}) {
  const [tasks, setTasks] = useState(props.initialTasks);
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<"tasks" | "stats" | "duties" | "structure" | "team">("tasks");
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

  async function saveMemberProfile(userId: string) {
    const profile = memberProfile(members.find((member) => member.user_id === userId));
    if (!profile) return;
    setProfileMessage("");
    const { error } = await createClient().from("profiles").update({
      employee_description: profile.employee_description?.trim() || "",
      birth_date: profile.birth_date || null,
    }).eq("id", userId);
    setProfileMessage(error ? "Не удалось сохранить карточку сотрудника." : `Карточка «${memberName(userId)}» сохранена.`);
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

  async function changePositionParent(positionId: string, parentPositionId: string) {
    const { error } = await createClient().from("positions").update({
      parent_position_id: parentPositionId || null,
    }).eq("id", positionId);
    if (!error) setPositions((items) => items.map((position) => position.id === positionId
      ? { ...position, parent_position_id: parentPositionId || null }
      : position));
  }

  async function changePositionPurpose(positionId: string, purpose: string) {
    setPositions((items) => items.map((position) => position.id === positionId ? { ...position, purpose } : position));
  }

  async function savePositionPurpose(positionId: string) {
    const position = positions.find((item) => item.id === positionId);
    if (!position) return;
    const { error } = await createClient().from("positions").update({ purpose: position.purpose.trim() }).eq("id", positionId);
    setPositionMessage(error ? "Не удалось сохранить цель должности." : `Должность «${position.name}» обновлена.`);
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
  const initials = props.name.split(" ").map((part) => part[0]).slice(0, 2).join("") || "Я";
  const rootPositions = positions.filter((position) => !position.parent_position_id || !positions.some((item) => item.id === position.parent_position_id));

  function renderPositionNode(position: Position, path: string[] = []) {
    if (path.includes(position.id)) return null;
    const assigned = members.filter((member) => member.position_id === position.id);
    const children = positions.filter((item) => item.parent_position_id === position.id);
    return <div className="org-branch" key={position.id}>
      <article className="org-node">
        <div className="org-node-heading"><span>ДОЛЖНОСТЬ</span><b>{position.name}</b></div>
        {position.purpose && <p>{position.purpose}</p>}
        <div className="org-people">
          {assigned.map((member) => <span key={member.user_id}><i>{memberName(member.user_id).slice(0, 1)}</i>{memberName(member.user_id)}</span>)}
          {!assigned.length && <span className="vacancy">＋ Вакансия</span>}
        </div>
      </article>
      {!!children.length && <div className="org-children">{children.map((child) => renderPositionNode(child, [...path, position.id]))}</div>}
    </div>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">▥</span>Неделька</div>
        <div className="org-name"><small>ОРГАНИЗАЦИЯ</small><strong>{props.organizationName}</strong></div>
        <nav>
          <button className={tab === "tasks" ? "active" : ""} onClick={() => setTab("tasks")}>✓ Мои задачи <b>{ownTasks.filter((task) => task.status !== "done").length}</b></button>
          <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}>▥ Статистика</button>
          <button className={tab === "duties" ? "active" : ""} onClick={() => setTab("duties")}>☷ Обязанности</button>
          <button className={tab === "structure" ? "active" : ""} onClick={() => setTab("structure")}>⌘ Оргструктура</button>
          {canManage && <button className={tab === "team" ? "active" : ""} onClick={() => setTab("team")}>◎ Команда <b>{members.length}</b></button>}
        </nav>
        <div className="profile">
          <span>{initials}</span>
          <div><strong>{props.name || props.email}</strong><small>Профиль · {roleName}</small></div>
          <button onClick={signOut}>Выйти →</button>
        </div>
      </header>

      <section className="workspace">
        {tab === "tasks" ? (
          <div className="content">
            {isNotificationContact && <section className="birthday-notifications">
              <div><span className="notification-icon">✦</span><div><strong>Уведомления о сотрудниках</strong><small>Вы назначены ответственным лицом</small></div></div>
              {birthdayNotifications.length ? birthdayNotifications.map((item) => (
                <article key={item.userId}><b>{item.name}</b><span>{item.days === 0 ? "День рождения сегодня" : item.days === 1 ? "День рождения завтра" : `Через ${item.days} дн.`}</span><time>{item.date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</time></article>
              )) : <p>В ближайшие 30 дней дней рождения нет.</p>}
            </section>}
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
        ) : tab === "structure" ? (
          <div className="content structure-content">
            <p className="eyebrow">КТО ЗА ЧТО ОТВЕЧАЕТ</p>
            <h1>Оргструктура</h1>
            <p className="lead">Большое дерево компании: должности, подчинённость, цели и сотрудники на каждом месте.</p>
            {canManage && <section className="structure-editor">
              <div><h2>Настройка дерева</h2><p>Выберите для каждой должности руководящую должность и кратко опишите её главную цель.</p></div>
              {positions.map((position) => <article key={position.id}>
                <strong>{position.name}</strong>
                <label>Подчиняется<select value={position.parent_position_id || ""} onChange={(event) => changePositionParent(position.id, event.target.value)}>
                  <option value="">Верхний уровень</option>
                  {positions.filter((item) => item.id !== position.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></label>
                <label>Цель должности<input value={position.purpose} onChange={(event) => changePositionPurpose(position.id, event.target.value)} placeholder="Какой главный результат даёт эта должность?" /></label>
                <button onClick={() => savePositionPurpose(position.id)}>Сохранить</button>
              </article>)}
              {positionMessage && <small className={positionMessage.startsWith("Не удалось") ? "form-error" : "form-success"}>{positionMessage}</small>}
            </section>}
            <div className="org-canvas">
              <div className="org-tree">
                {rootPositions.map((position) => renderPositionNode(position))}
                {!positions.length && <div className="empty"><b>Дерево пока пустое</b><p>Руководитель может добавить должности в разделе «Команда».</p></div>}
              </div>
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
                  <span>{profile?.full_name?.slice(0, 1) || "•"}</span>
                  <div className="member-identity"><strong>{profile?.full_name || profile?.email}</strong><small>{member.role === "owner" ? "Владелец" : member.role === "manager" ? "Руководитель" : "Сотрудник"}{member.job_title ? ` · ${member.job_title}` : ""}{member.is_notification_contact ? " · Ответственный за уведомления" : ""}</small></div>
                  <label className="member-position">Должность<select value={member.position_id || ""} onChange={(event) => changeMemberPosition(member.user_id, event.target.value)}><option value="">Не выбрана</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}</select></label>
                  <div className="member-details">
                    <label>Дата рождения<input type="date" value={profile?.birth_date || ""} onChange={(event) => updateMemberProfile(member.user_id, { birth_date: event.target.value || null })} /></label>
                    <label>Описание сотрудника<textarea value={profile?.employee_description || ""} onChange={(event) => updateMemberProfile(member.user_id, { employee_description: event.target.value })} placeholder="Сильные стороны, опыт, важные особенности работы…" /></label>
                    <button onClick={() => saveMemberProfile(member.user_id)}>Сохранить карточку</button>
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
