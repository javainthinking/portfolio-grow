import createMiddleware from "next-intl/middleware";
import { defaultLocale, locales } from "./src/i18n/routing";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always" // always prefix locales: /en, /zh
});

export const config = {
  // Skip Next.js internals and APIs.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
