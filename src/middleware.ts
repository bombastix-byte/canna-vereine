import { defineMiddleware } from 'astro:middleware';
import { neuePb } from './lib/pb';
import { ladeFunktionen, funktionenDefault } from './lib/einstellungen';

// Lädt für App-Anfragen die effektiven Funktions-Module (Config-Default +
// DB-Override) einmal pro Anfrage in `locals.funktionen`. Navigation und
// Modul-Guards lesen daraus — so wirkt ein Umschalten im Admin sofort.
export const onRequest = defineMiddleware(async (context, next) => {
  const p = context.url.pathname;
  if (p.startsWith('/mitglieder') || p.startsWith('/api')) {
    try {
      context.locals.funktionen = await ladeFunktionen(neuePb());
    } catch {
      context.locals.funktionen = funktionenDefault();
    }
  }
  return next();
});
