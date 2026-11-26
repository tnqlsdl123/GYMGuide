import { loadData } from './site.js';

export const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
export const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일'];
export const usageLabels = {
    RESTRICTED: '헬스장 이용 불가',
    NOT_RESTRICTED: '이용 제한 없음 확인',
    UNKNOWN: '제한 여부 확인 필요'
};

const statusLabels = {
    AVAILABLE: ['이용 가능', '등록된 운영 시간과 확인된 일정 기준이에요. 실제 이용 여부는 현장 공지에 따라 달라질 수 있어요.'],
    UNAVAILABLE: ['이용 불가', '현재 확인된 헬스장 이용 제한 시간이에요.'],
    CLOSED: ['운영 시간 외', '등록된 운영 시간 기준으로 현재는 운영하지 않아요.'],
    CHECK_REQUIRED: ['확인 필요', '현재 수업이 진행 중이며 헬스장 이용 제한 여부는 확인되지 않았어요.'],
    UNKNOWN: ['확인 필요', '현재 상태를 판단할 운영 시간 또는 적용 일정 정보가 충분하지 않아요.']
};
const seoulClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

export function dayIndex(date) {
    return (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
}

export function shiftDate(date, days) {
    const shifted = new Date(date + 'T00:00:00Z');
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
}

export function monthDay(date, separator = '월 ', ending = '일') {
    const [, month, day] = date.split('-');
    return Number(month) + separator + Number(day) + ending;
}

export function seoulNow(instant = new Date()) {
    const parts = Object.fromEntries(seoulClock.formatToParts(instant).map(({ type, value }) => [type, value]));
    const date = parts.year + '-' + parts.month + '-' + parts.day;
    const time = parts.hour + ':' + parts.minute + ':' + parts.second;
    return { date, time, second: timeToSeconds(time) };
}

export function timeToSeconds(time) {
    if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return NaN;
    const [hour, minute, second = 0] = time.split(':').map(Number);
    return hour * 3600 + minute * 60 + second;
}

export function timeLabel(time) {
    return time.length > 5 && time.endsWith(':00') ? time.slice(0, 5) : time;
}

function validTimes({ start, end }) {
    return timeToSeconds(end) > timeToSeconds(start);
}

export function timeRange(entry) {
    return validTimes(entry) ? timeLabel(entry.start) + '–' + timeLabel(entry.end) : '시간 확인 필요';
}

export function hasDates(entry) {
    return Boolean(entry.effectiveFrom && entry.effectiveTo);
}

function appliesOn(entry, date) {
    return entry.day === weekdays[dayIndex(date)] && hasDates(entry) &&
        entry.effectiveFrom <= date && date <= entry.effectiveTo;
}

function includes(entry, second) {
    return timeToSeconds(entry.start) <= second && second < timeToSeconds(entry.end);
}

export function hoursOn(schedule, date) {
    return schedule.operatingHours.filter(entry => appliesOn(entry, date) && (entry.closed || validTimes(entry)));
}

export function entriesOn(schedule, date) {
    const confirmed = hoursOn(schedule, date).some(entry => entry.scheduleConfirmed);
    return schedule.classes.filter(entry => appliesOn(entry, date) ||
        (!confirmed && !hasDates(entry) && entry.day === weekdays[dayIndex(date)]))
        .sort((a, b) => (a.start ?? '99:99').localeCompare(b.start ?? '99:99'));
}

export function isCurrent(entry, date, now) {
    return date === now.date && appliesOn(entry, date) && includes(entry, now.second);
}

function nextOccurrence(entry, now) {
    const earliest = entry.effectiveFrom > now.date ? entry.effectiveFrom : now.date;
    const offset = (weekdays.indexOf(entry.day) - dayIndex(earliest) + weekdays.length) % weekdays.length;
    let date = shiftDate(earliest, offset);
    if (date === now.date && timeToSeconds(entry.start) <= now.second) date = shiftDate(date, 7);
    return date <= entry.effectiveTo ? date + 'T' + entry.start : null;
}

function availabilityState(today, hours, second) {
    const open = hours.filter(entry => !entry.closed && includes(entry, second));
    if (today.some(entry => entry.usage === 'RESTRICTED' && includes(entry, second))) return 'UNAVAILABLE';
    if (hours.length && !open.length) return 'CLOSED';
    if (today.some(entry => entry.usage === 'UNKNOWN' && includes(entry, second))) return 'CHECK_REQUIRED';
    if (open.some(entry => entry.scheduleConfirmed) &&
        !today.some(entry => entry.usage !== 'NOT_RESTRICTED' && !validTimes(entry))) return 'AVAILABLE';
    return 'UNKNOWN';
}

export function gymStatus(schedule, now) {
    const today = schedule.classes.filter(entry => appliesOn(entry, now.date));
    const state = availabilityState(today, hoursOn(schedule, now.date), now.second);
    const restrictions = schedule.classes.filter(entry =>
        entry.usage === 'RESTRICTED' && hasDates(entry) && weekdays.includes(entry.day) && validTimes(entry));
    if (state === 'UNAVAILABLE') {
        let end = now.second;
        let endLabel = '';
        const ordered = restrictions.filter(entry => appliesOn(entry, now.date))
            .sort((a, b) => timeToSeconds(a.start) - timeToSeconds(b.start));
        for (const entry of ordered) {
            if (timeToSeconds(entry.start) <= end && timeToSeconds(entry.end) > end) {
                end = timeToSeconds(entry.end);
                endLabel = entry.end;
            }
        }
        return ['UNAVAILABLE', '현재 제한 종료 ' + monthDay(now.date) + ' ' + timeLabel(endLabel)];
    }

    const next = restrictions.map(entry => nextOccurrence(entry, now)).filter(Boolean).sort()[0];
    if (!next) return [state, ''];
    const [date, time] = next.split('T');
    return [state, '다음 제한 시작 ' + monthDay(date) + ' ' + timeLabel(time)];
}

function upcomingLabel(date, time) {
    return monthDay(date, '.', '') + ' (' + weekdayLabels[dayIndex(date)] + ') ' + timeLabel(time);
}

export function nextClassLabel(schedule, now) {
    const classes = schedule.classes.filter(entry => !entry.restrictionOnly && validTimes(entry));
    const confirmed = classes.filter(entry => hasDates(entry) && weekdays.includes(entry.day))
        .map(entry => ({ entry, at: nextOccurrence(entry, now) }))
        .filter(({ at }) => at)
        .sort((a, b) => a.at.localeCompare(b.at))[0];
    if (confirmed) {
        const [date, time] = confirmed.at.split('T');
        return upcomingLabel(date, time) + ' · ' + confirmed.entry.name;
    }

    for (let offset = 0; offset <= weekdays.length; offset++) {
        const date = shiftDate(now.date, offset);
        const entry = entriesOn(schedule, date).find(entry =>
            !entry.restrictionOnly && !hasDates(entry) && validTimes(entry) &&
            (offset > 0 || timeToSeconds(entry.start) > now.second));
        if (entry) return upcomingLabel(date, entry.start) + ' · ' + entry.name + ' (참고)';
    }
    return '예정된 수업 정보 없음';
}

export function availablePeriods(schedule, date) {
    const hours = hoursOn(schedule, date);
    const confirmedHours = hours.filter(entry => !entry.closed && entry.scheduleConfirmed);
    if (!confirmedHours.length) return [];
    const today = schedule.classes.filter(entry => appliesOn(entry, date));
    const timed = [...confirmedHours, ...today.filter(validTimes)];
    const boundaries = [...new Set(timed.flatMap(entry =>
        [timeToSeconds(entry.start), timeToSeconds(entry.end)]))].sort((a, b) => a - b);
    const periods = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
        const start = boundaries[i];
        const end = boundaries[i + 1];
        if (availabilityState(today, hours, start) !== 'AVAILABLE') continue;
        const previous = periods.at(-1);
        if (previous?.end === start) previous.end = end;
        else periods.push({ start, end });
    }
    return periods;
}

export function nextAvailableLabel(schedule, now, state) {
    if (state === 'AVAILABLE') return '지금 이용 가능';
    if (!schedule.operatingHours.some(entry => entry.scheduleConfirmed && !entry.closed)) return '확인된 이용 시간 없음';

    // Active date ranges change only at their boundaries. Between them, the schedule repeats each week.
    const anchors = new Set([now.date]);
    for (const entry of [...schedule.operatingHours, ...schedule.classes].filter(hasDates)) {
        if (entry.effectiveFrom > now.date) anchors.add(entry.effectiveFrom);
        if (entry.effectiveTo >= now.date) anchors.add(shiftDate(entry.effectiveTo, 1));
    }
    const dates = new Set();
    for (const anchor of anchors) {
        for (let offset = 0; offset <= weekdays.length; offset++) dates.add(shiftDate(anchor, offset));
    }
    for (const date of [...dates].sort()) {
        const period = availablePeriods(schedule, date).find(({ start }) => date !== now.date || start > now.second);
        if (period) {
            const time = new Date(period.start * 1000).toISOString().slice(11, 19);
            return upcomingLabel(date, time);
        }
    }
    return '확인된 이용 시간 없음';
}

export async function watchSchedule(onUpdate, onError) {
    const banner = document.querySelector('.gym-status');
    const badge = banner.querySelector('.gym-state');
    const description = banner.querySelector('.gym-description');
    const transition = banner.querySelector('.gym-transition');
    const checked = banner.querySelector('.gym-checked');
    const nextClass = banner.querySelector('.next-class');
    const nextAvailable = banner.querySelector('.next-available');
    let schedule;

    function update() {
        const now = seoulNow();
        const clock = now.time.slice(0, 5);
        checked.dateTime = now.date + 'T' + clock + '+09:00';
        if (checked.textContent !== clock) checked.textContent = clock;
        if (schedule) {
            const [state, next] = gymStatus(schedule, now);
            banner.dataset.status = state;
            const [label, details] = statusLabels[state];
            if (badge.textContent !== label) badge.textContent = label;
            description.textContent = details;
            transition.textContent = next;
            transition.hidden = !next;
            if (nextClass) nextClass.textContent = nextClassLabel(schedule, now);
            if (nextAvailable) nextAvailable.textContent = nextAvailableLabel(schedule, now, state);
            onUpdate?.(schedule, now);
        }
    }

    update();
    try {
        schedule = await loadData('schedule.json');
        update();
    } catch (error) {
        schedule = null;
        banner.dataset.status = 'UNKNOWN';
        badge.textContent = '확인 필요';
        description.textContent = '일정 정보를 불러오지 못했어요.';
        transition.hidden = true;
        if (nextClass) nextClass.textContent = '확인할 수 없음';
        if (nextAvailable) nextAvailable.textContent = '확인할 수 없음';
        banner.querySelector('[data-retry]').hidden = false;
        onError?.();
        console.error(error);
    }
    window.setInterval(() => {
        if (!document.hidden) update();
    }, 1000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) update();
    });
}
