import AuthForm from "./auth-form";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand"><span className="brand-mark">▥</span>Неделька</div>
        <div>
          <span className="kicker">РАБОТА В СВОЁМ РИТМЕ</span>
          <h1>Задачи видны.<br />Команда спокойна.</h1>
          <p>Создайте организацию с нуля, пригласите коллег и синхронизируйтесь раз в неделю.</p>
        </div>
        <small>Никаких демонстрационных сотрудников — только ваша команда.</small>
      </section>
      <section className="auth-panel"><AuthForm invite={invite} /></section>
    </main>
  );
}
