/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Effektive Funktions-Module dieser Anfrage (Config-Default + DB-Override). */
    funktionen?: import('./lib/einstellungen').Funktionen;
    /** Konfiguration der externen Kassen-Anbindung. */
    kasseExtern?: import('./lib/kassen-konnektor').KonnektorConfig;
    /** Gewählte Oberflächensprache (Cookie, Default de). */
    sprache?: import('./lib/i18n').Sprache;
  }
}
