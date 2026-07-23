import type PocketBase from 'pocketbase';

export function normalisiereMitgliedsnummer(wert: unknown): string {
  return String(wert ?? '').trim().toUpperCase();
}

export function mitgliedsnummerGueltig(wert: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{1,31}$/.test(wert);
}

export async function mitgliedsnummerVergeben(
  pb: PocketBase,
  nummer: string,
  ausserId?: string,
): Promise<boolean> {
  if (!nummer) return false;
  const filter = ausserId
    ? pb.filter('mitgliedsnummer = {:nummer} && id != {:id}', { nummer, id: ausserId })
    : pb.filter('mitgliedsnummer = {:nummer}', { nummer });
  try {
    await pb.collection('users').getFirstListItem(filter, { fields: 'id' });
    return true;
  } catch (error: any) {
    if (error?.status === 404) return false;
    throw error;
  }
}
