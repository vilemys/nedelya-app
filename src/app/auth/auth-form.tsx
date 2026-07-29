"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm({ invite = "" }: { invite?: string }) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`,
        },
      });
      if (error) setMessage(error.message);
      else if (data.session) window.location.href = invite ? `/?invite=${encodeURIComponent(invite)}` : "/";
      else setMessage("Проверьте почту и подтвердите регистрацию.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage("Не удалось войти. Проверьте почту и пароль.");
      else window.location.href = invite ? `/?invite=${encodeURIComponent(invite)}` : "/";
    }
    setLoading(false);
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-tabs">
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); }}>Регистрация</button>
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>Войти</button>
      </div>
      <p className="eyebrow">{invite ? "ПРИГЛАШЕНИЕ В КОМАНДУ" : mode === "signup" ? "НАЧНЁМ С НУЛЯ" : "С ВОЗВРАЩЕНИЕМ"}</p>
      <h2>{mode === "signup" ? "Создайте аккаунт" : "Войдите в Недельку"}</h2>
      <p className="sub">{invite ? "Войдите или создайте аккаунт с той почтой, на которую вас пригласили." : mode === "signup" ? "После регистрации вы создадите пустую организацию." : "Ваши задачи и команда уже ждут."}</p>
      {mode === "signup" && <label>Ваше имя<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Анна Крылова" /></label>}
      <label>Рабочая почта<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.ru" /></label>
      <label>Пароль<input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов" /></label>
      {message && <div className={message.startsWith("Проверьте") ? "notice success" : "notice"}>{message}</div>}
      <button className="primary" disabled={loading}>{loading ? "Подождите…" : mode === "signup" ? "Зарегистрироваться →" : "Войти →"}</button>
      <small className="legal">Регистрируясь, вы соглашаетесь с условиями использования и политикой конфиденциальности.</small>
    </form>
  );
}
