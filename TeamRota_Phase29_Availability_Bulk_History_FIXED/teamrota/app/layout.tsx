import "./globals.css";
import type { Metadata } from "next";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import TeamRotaAssistant from "@/app/components/TeamRotaAssistant";

export const metadata: Metadata = {
  title: "TeamRota",
  description: "Team rota, leave and timesheet management",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LanguageSwitcher />
        {children}
        <TeamRotaAssistant />
      </body>
    </html>
  );
}
