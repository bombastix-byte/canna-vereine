import type { APIRoute } from 'astro';
import { mitgliedAusToken, AUTH_COOKIE } from '../../../lib/pb';
import { stat, readFile } from 'node:fs/promises';

// Liefert die Android-App (APK) an angemeldete Mitglieder aus. Die Datei
// liegt NICHT oeffentlich im Web, sondern auf dem Server (Pfad ueber die
// Umgebungsvariable APK_PFAD, im Container per Volume eingebunden).
export const prerender = false;

export const APK_STANDARD_PFAD = 'deploy/downloads/canna-verein.apk';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const ergebnis = await mitgliedAusToken(cookies.get(AUTH_COOKIE)?.value);
  if (!ergebnis) return redirect('/mitglieder?fehler=anmeldung', 303);

  const pfad = process.env.APK_PFAD ?? APK_STANDARD_PFAD;
  try {
    await stat(pfad);
  } catch {
    return new Response('Die App-Datei liegt noch nicht auf dem Server.', { status: 404 });
  }
  const daten = await readFile(pfad);
  return new Response(daten, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="canna-verein.apk"',
      'Content-Length': String(daten.byteLength),
      'Cache-Control': 'no-store',
    },
  });
};
