/**
 * Joylashuv aniqlash va manzilga aylantirish.
 * 1) browser navigator.geolocation orqali lat/lng oladi
 * 2) Nominatim (OpenStreetMap) orqali reverse geocode qiladi
 */

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  address: string;
}

export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation API qo\'llab-quvvatlanmaydi');
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        const messages: Record<number, string> = {
          1: 'Joylashuvga ruxsat berilmadi',
          2: 'Joylashuv aniqlanmadi',
          3: 'Vaqt tugadi',
        };
        reject(new Error(messages[err.code] ?? 'Joylashuv olishda xatolik'));
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  language: 'uz' | 'ru' = 'uz',
): Promise<string> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('accept-language', language === 'ru' ? 'ru' : 'uz');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '18');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Marketplace WebApp (marketplace.yuksalish.dev)' },
  });
  if (!res.ok) throw new Error('Manzilni topib bo\'lmadi');
  const data = (await res.json()) as {
    display_name?: string;
    address?: Record<string, string | undefined>;
  };

  // Eng yaxshi natija — display_name. Lekin oddiyroq qilamiz:
  const a = data.address ?? {};
  const parts = [
    a.road ?? a.pedestrian ?? a.cycleway ?? a.path,
    a.house_number,
    a.suburb ?? a.neighbourhood ?? a.quarter,
    a.city ?? a.town ?? a.village ?? a.municipality,
    a.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : data.display_name ?? '';
}

export async function detectMyLocation(language: 'uz' | 'ru' = 'uz'): Promise<GeolocationResult> {
  const { latitude, longitude } = await getCurrentLocation();
  let address = '';
  try {
    address = await reverseGeocode(latitude, longitude, language);
  } catch {
    address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }
  return { latitude, longitude, address };
}
