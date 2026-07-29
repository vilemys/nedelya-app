import AuthForm from "./auth-form";

export default function AuthPage() {
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand"><span className="brand-mark">▥</span>Неделя</div>
        <div>
          <span className="kicker">РАБОТА В СВОЁМ РИТМЕ</span>
          <h1>Задачи видны.<br />Команда спокойна.</h1>
          <p>Создайте организацию с нуля, пригласите коллег и синхронизируйтесь раз в неделю.</p>
        </div>
        <small>Никаких демонстрационных сотрудников — только ваша команда.</small>
      </section>
      <section className="auth-panel"><AuthForm /></section>
    </main>
  );
}
