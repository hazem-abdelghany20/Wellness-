// NOAA-derived solar position + prayer-time calculation.
// Accuracy ±a few minutes — sufficient for v0 Ramadan Mode.
// All angles in radians unless otherwise noted.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

// Cairo coordinates and standard tz (no DST — Egypt suspended seasonal
// switching). When Egypt resumes DST, override tzOffsetMinutes per call.
export const CAIRO = Object.freeze({ lat: 30.0444, lng: 31.2357, tzOffsetMinutes: 120 });

function julianDayUTC(date) {
  // UTC date; the 0.5 lift makes JD start at noon UTC of the given day.
  const utcMid = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
  return utcMid / 86400000 + 2440587.5;
}

export function solarParams(jd) {
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
  const epsilon = 23.439 * RAD;
  const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  // Equation of time in minutes.
  const eotDegrees = (L - 0.0057183 - DEG * Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)));
  const equationOfTime = 4 * eotDegrees;
  return { declination, equationOfTime };
}

function hourAngleFor(altitudeDeg, latDeg, declination) {
  const altitude = altitudeDeg * RAD;
  const lat = latDeg * RAD;
  const cosH = (Math.sin(altitude) - Math.sin(lat) * Math.sin(declination))
    / (Math.cos(lat) * Math.cos(declination));
  if (cosH < -1 || cosH > 1) return null;
  return Math.acos(cosH) * DEG; // degrees
}

function fmtHHMM(localHours) {
  let h = ((localHours % 24) + 24) % 24;
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Returns { fajr, sunrise, sunset, suhoor, iftar } for the given date.
// suhoor is the recommended end of pre-dawn meal (= fajr).
// iftar is sunset.
export function prayerTimes(date, location = CAIRO) {
  const { lat, lng, tzOffsetMinutes } = location;
  const jd = julianDayUTC(date);
  const { declination, equationOfTime } = solarParams(jd);
  const solarNoonUTC = 12 - lng / 15 - equationOfTime / 60;

  const haRise = hourAngleFor(-0.833, lat, declination);
  const haFajr = hourAngleFor(-18,    lat, declination);
  if (haRise == null || haFajr == null) return null;

  const utcToLocal = (utcHours) => utcHours + tzOffsetMinutes / 60;

  return {
    fajr:    fmtHHMM(utcToLocal(solarNoonUTC - haFajr / 15)),
    sunrise: fmtHHMM(utcToLocal(solarNoonUTC - haRise / 15)),
    sunset:  fmtHHMM(utcToLocal(solarNoonUTC + haRise / 15)),
    suhoor:  fmtHHMM(utcToLocal(solarNoonUTC - haFajr / 15)),
    iftar:   fmtHHMM(utcToLocal(solarNoonUTC + haRise / 15)),
  };
}
