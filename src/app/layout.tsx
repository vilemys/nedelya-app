import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Неделя",
  description: "Задачи и еженедельные итоги команды без микроменеджмента",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
