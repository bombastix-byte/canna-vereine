/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Effektive Funktions-Module dieser Anfrage (Config-Default + DB-Override). */
    funktionen?: import('./lib/einstellungen').Funktionen;
  }
}
