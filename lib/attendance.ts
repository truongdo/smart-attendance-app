import { differenceInMinutes, format, isAfter, isBefore, set } from 'date-fns';

export const WORK_START_TIME = '08:00';
export const WORK_END_TIME = '17:30';
export const LUNCH_START = '12:00';
export const LUNCH_END = '13:00';

export const calculateHours = (inTime: Date, outTime: Date) => {
  const normalizedIn = isBefore(inTime, set(inTime, { hours: 8, minutes: 0 }))
    ? set(inTime, { hours: 8, minutes: 0 })
    : inTime;

  const standardOut = set(outTime, { hours: 17, minutes: 30 });
  const actualOut = outTime;

  let totalMinutes = differenceInMinutes(actualOut, normalizedIn);

  if (
    isBefore(normalizedIn, set(normalizedIn, { hours: 12, minutes: 0 })) &&
    isAfter(actualOut, set(actualOut, { hours: 13, minutes: 0 }))
  ) {
    totalMinutes -= 60;
  }

  let workMinutes = 0;
  const effectiveOutForWork = isAfter(actualOut, standardOut) ? standardOut : actualOut;

  if (isAfter(effectiveOutForWork, normalizedIn)) {
    workMinutes = differenceInMinutes(effectiveOutForWork, normalizedIn);
    if (
      isBefore(normalizedIn, set(normalizedIn, { hours: 12, minutes: 0 })) &&
      isAfter(effectiveOutForWork, set(effectiveOutForWork, { hours: 13, minutes: 0 }))
    ) {
      workMinutes -= 60;
    }
  }

  let otMinutes = 0;
  if (isAfter(actualOut, standardOut)) {
    otMinutes = differenceInMinutes(actualOut, standardOut);
  }

  return {
    workHours: Math.max(0, workMinutes / 60),
    overtimeHours: Math.max(0, otMinutes / 60),
    totalHours: Math.max(0, totalMinutes / 60),
  };
};

export const needsExplanation = (type: 'in' | 'out', time: Date) => {
  const hours = time.getHours();
  const minutes = time.getMinutes();

  if (type === 'in') {
    if (hours > 8 || (hours === 8 && minutes > 30)) return true;
  } else {
    if (hours < 17) return true;
  }

  return false;
};

export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const formatDateYmd = (d: Date) => format(d, 'yyyy-MM-dd');

