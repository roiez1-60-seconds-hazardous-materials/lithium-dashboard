import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מעקב שריפות סוללות ליתיום יון — כבאות והצלה",
  description: "דשבורד מעקב שריפות סוללות ליתיום יון בישראל",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, padding: 0, background: "#0c0a09" }}>
        {children}
      </body>
    </html>
  );
}
