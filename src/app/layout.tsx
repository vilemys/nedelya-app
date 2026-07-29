import type { Metadata } from "next";
import "./globals.css";
import "./navigation.css";

export const metadata: Metadata = {
  title: "Неделька",
  description: "Задачи и еженедельные итоги команды без микроменеджмента",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
