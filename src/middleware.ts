import { defineMiddleware } from 'astro:middleware';
import { neuePb } from './lib/pb';
import { ladeFunktionen, funktionenDefault, ladeKonnektor } from './lib/einstellungen';
import { spracheAus, SPRACHE_COOKIE } from './lib/i18n';

// Lädt für App-Anfragen die effektiven Funktions-Module (Config-Default +
// DB-Override) und die Kassen-Konnektor-Konfiguration einmal pro Anfrage in
// `locals`. Navigation, Modul-Guards und der Konnektor lesen daraus — so wirkt
// ein Umschalten im Admin sofort.
export const onRequest = defineMiddleware(async (context, next) => {
  const p = context.url.pathname;
  // Sprachwahl (Cookie) für alle Seiten bereitstellen.
  context.locals.sprache = spracheAus(context.cookies.get(SPRACHE_COOKIE)?.value);
  if (p.startsWith('/mitglieder') || p.startsWith('/api')) {
    const pb = neuePb();
    try {
      context.locals.funktionen = await ladeFunktionen(pb);
    } catch {
      context.locals.funktionen = funktionenDefault();
    }
    try {
      context.locals.kasseExtern = await ladeKonnektor(pb);
    } catch {
      context.locals.kasseExtern = { typ: 'keiner' };
    }
  }
  return next();
});
