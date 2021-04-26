export function dateDiffToTime(diff: number, suffix = ""): string {
  const diffSec = diff / 1000;
  if (diffSec < 60) {
    return Math.floor(diffSec) + "с" + suffix;
  }

  //less 1hour
  if (diffSec < 3600) {
    const diffMin = Math.floor(diffSec / 60);
    let str = diffMin + "м";
    if (diffMin < 5) {
      const leftSec = Math.floor(diffSec - diffMin * 60);
      if (leftSec) {
        str += " " + leftSec + "с";
      }
    }
    return str + suffix;
  }

  //less 1day
  if (diffSec < 24 * 3600) {
    const diffHour = Math.floor(diffSec / 3600);
    let str = diffHour + "ч";
    const leftMin = Math.floor(diffSec / 60 - diffHour * 60);
    if (leftMin) {
      str += " " + leftMin + "м";
    }
    return str + suffix;
  }

  // >= 1day
  const diffDay = Math.floor(diffSec / (24 * 3600));
  let str = diffDay + "д";
  if (diffDay <= 2) {
    const leftHour = Math.floor(diffSec / 3600 - diffDay * 24);
    if (leftHour) {
      str += " " + leftHour + "ч";
    }
  }
  return str + suffix;
}

export default function dateToPastTime(dt: number, suffix = " назад"): string {
  return dateDiffToTime(Date.now() - dt, suffix);
}
