import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "פוצ'יוולי | הימורים וליגות",
  description: "אפליקציית הימורי תוצאות, פנטזי וליגות סגורות לפוצ'יוולי",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-dark text-slate-100">
        {children}
      </body>
    </html>
  );
}
