"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Onboarding({ name, invitationError = "" }: { name: string; invitationError?: string }) {
  const [organization, setOrganization] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_organization", { organization_name: organization });
    if (error) {
      setError("Не удалось создать организацию. Проверьте, что схема базы установлена.");
      setLoading(false);
      return;
    }
    window.location.reload();
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-card">
        <div className="step">ШАГ 1 ИЗ 1</div>
        <h1>Добро пожаловать{name ? `, ${name}` : ""}!</h1>
        <p>Создайте рабочее пространство. Оно будет пустым — сотрудников и задачи вы добавите самостоятельно.</p>
        {invitationError && <div className="notice">{invitationError}</div>}
        <form onSubmit={create}>
          <label>Название организации<input autoFocus required minLength={2} value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Например, Студия Север" /></label>
          {error && <div className="notice">{error}</div>}
          <button className="primary" disabled={loading}>{loading ? "Создаём…" : "Создать организацию →"}</button>
        </form>
        <div className="promise-grid">
          <span><b>Пустое пространство</b><small>Без чужих тестовых данных</small></span>
          <span><b>Вы — владелец</b><small>Можно назначить руководителей</small></span>
          <span><b>Свои задачи</b><small>Руководители тоже планируют работу</small></span>
        </div>
      </section>
    </main>
  );
}
