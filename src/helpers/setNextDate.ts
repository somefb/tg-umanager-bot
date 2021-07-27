const totalMinutesDay = 24 * 60;

/** set next date and setup particular time; targetTimezone is Minsk by default */
export function setNextDate(targetTime: number, targetTzOffset = -180): number {
  const now = new Date();
  now.setSeconds(0, 0);
  const nowUtc = now.getTime();

  let localTime = targetTime - (now.getTimezoneOffset() - targetTzOffset);

  if (localTime < 0) {
    localTime += totalMinutesDay;
  } else if (localTime >= totalMinutesDay) {
    localTime -= totalMinutesDay;
  }
  const h = Math.floor(localTime / 60);
  const m = Math.floor(localTime - h * 60);
  let nextDateUtc = now.setHours(h, m);
  if (nextDateUtc <= nowUtc) {
    nextDateUtc += 24 * 60 * 60000;
  }
  return nextDateUtc;
}
