/// <reference path="../pb_data/types.d.ts" />
// Täglicher Trigger für die Erinnerungs-Automatik. Die eigentliche Logik und
// der Push-Versand liegen im Astro-Endpoint /api/erinnerungen; dieser Hook ruft
// ihn nur zeitgesteuert auf. Der Token kommt aus der Container-Umgebung
// (CRON_TOKEN) und schützt den Endpoint vor fremden Aufrufen.
// Zeit: 08:00 Container-Zeit (UTC) ~ 10:00 Berlin (Sommerzeit).
cronAdd("erinnerungen", "0 8 * * *", () => {
  const token = $os.getenv("CRON_TOKEN");
  if (!token) {
    console.log("[erinnerungen] CRON_TOKEN nicht gesetzt - übersprungen");
    return;
  }
  try {
    const res = $http.send({
      url: "http://astro-goerlitz:4321/api/erinnerungen?token=" + token,
      method: "GET",
      timeout: 120,
    });
    console.log("[erinnerungen] Status " + res.statusCode + ": " + res.raw);
  } catch (e) {
    console.log("[erinnerungen] Fehler: " + e);
  }
});
