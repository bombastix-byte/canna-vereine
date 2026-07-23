import { defineMiddleware } from 'astro:middleware';
import { neuePb } from './lib/pb';
import { ladeFunktionen, funktionenDefault, ladeKonnektor } from './lib/einstellungen';
import { spracheAus, SPRACHE_COOKIE } from './lib/i18n';
import { originErlaubt } from './lib/origin';
import { istVereinsarbeitPfad } from './lib/vereinsarbeit';

// Lädt für App-Anfragen die effektiven Funktions-Module (Config-Default +
// DB-Override) und die Kassen-Konnektor-Konfiguration einmal pro Anfrage in
// `locals`. Navigation, Modul-Guards und der Konnektor lesen daraus — so wirkt
// ein Umschalten im Admin sofort.
export const onRequest = defineMiddleware(async (context, next) => {
  if (!originErlaubt(context.request, process.env.TRUSTED_ORIGINS ?? '')) {
    return new Response('Ungueltiger Anfrage-Ursprung.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const p = context.url.pathname;
  // Sprachwahl (Cookie) für alle Seiten bereitstellen.
  const appAnfrage = p.startsWith('/mitglieder') || p.startsWith('/api') || p === '/sprache';
  context.locals.sprache = istVereinsarbeitPfad(p)
    ? 'de'
    : appAnfrage
    ? spracheAus(context.cookies.get(SPRACHE_COOKIE)?.value)
    : 'de';
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
