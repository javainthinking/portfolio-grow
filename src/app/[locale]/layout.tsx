import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { defaultLocale, locales, type Locale } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Portfolio Grow",
  description: "Live-ish quotes dashboard",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const safeLocale = (locales.includes(locale as any) ? locale : defaultLocale) as Locale;
  const messages = await getMessages();

  return (
    <html lang={safeLocale}>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
