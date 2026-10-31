/** Primer segmento de URL que NO puede ser slug de barbería (rutas de la app, Next, archivos). */
export const RESERVED_SLUGS = new Set([
  "app", "api", "b", "c", "l", "login", "logout", "signup", "register", "onboarding", "auth", "admin", "dashboard",
  "_next", "static", "img", "images", "assets", "public", "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json",
  "cita", "reservar", "book", "precios", "pricing", "terms", "privacy", "privacidad", "terminos", "help", "ayuda", "soporte", "www", "captura",
]);
export const isReservedSlug = (s: string) => RESERVED_SLUGS.has(s.toLowerCase());
