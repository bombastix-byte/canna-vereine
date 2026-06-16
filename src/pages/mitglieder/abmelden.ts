import type { APIRoute } from 'astro';
import { AUTH_COOKIE } from '../../lib/pb';

// Logout: Cookie loeschen und zurueck zum Login.
export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(AUTH_COOKIE, { path: '/' });
  return redirect('/mitglieder?abgemeldet=1', 303);
};
