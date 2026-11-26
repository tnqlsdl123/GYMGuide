import { element } from './site.js';
import {
    dayIndex, entriesOn, hasDates, hoursOn, isCurrent, monthDay, shiftDate,
    timeRange, timeToSeconds, usageLabels, watchSchedule, weekdayLabels, weekdays
} from './gym.js';

const week = document.querySelector('#week');
const tabs = document.querySelector('.schedule-tabs');
const calendar = document.querySelector('.calendar');
const todayDate = document.querySelector('#today-date');
const todayList = document.querySelector('.today-list');
const todayEmpty = document.querySelector('.schedule-empty');
const weekdayColumns = weekdays.slice(0, 5);
let currentDate;
let currentMarkers = [];

function showDay() {
    const requestedDay = new URLSearchParams(location.search).get('day');
    const fallback = weekdayColumns[dayIndex(currentDate)] ?? weekdayColumns[0];
    const selectedDay = weekdayColumns.includes(requestedDay) ? requestedDay : fallback;
    tabs.querySelectorAll('a').forEach(link => {
        if (link.dataset.day === selectedDay) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
    });
    calendar.querySelectorAll('.calendar-day').forEach(column => {
        column.classList.toggle('selected', column.dataset.day === selectedDay);
    });
}

function createTodayEntry(entry) {
    const line = element('li');
    const details = element('div');
    details.append(element('strong', '', entry.name));
    if (entry.classroom) details.append(element('span', 'schedule-room', entry.classroom));
    if (!hasDates(entry)) details.append(element('span', 'schedule-reference', '적용 기간 미확인'));
    const live = element('span', 'schedule-live', entry.restrictionOnly ? '제한 중' : '진행 중');
    live.hidden = true;
    line.append(element('time', '', timeRange(entry)), details, live);
    if (!entry.restrictionOnly) {
        const usage = element('span', 'schedule-usage', usageLabels[entry.usage]);
        usage.dataset.usage = entry.usage;
        line.append(usage);
    }
    currentMarkers.push({ node: line, entry, date: currentDate, live });
    return line;
}

function createEvent({ entry, lane, top, bottom }, date, laneCount) {
    const card = element('article', 'calendar-event');
    card.dataset.usage = entry.usage;
    card.style.top = top + '%';
    card.style.height = (bottom - top) + '%';
    card.style.left = (lane * 100 / laneCount) + '%';
    card.style.width = (100 / laneCount) + '%';
    card.title = [entry.name, timeRange(entry), usageLabels[entry.usage]].join(' · ');

    const content = element('div', 'calendar-event-content');
    const time = element('div', 'calendar-event-time');
    time.append(element('time', '', timeRange(entry)));
    if (!hasDates(entry)) {
        const reference = element('span', 'calendar-reference', '참고');
        reference.title = '적용 기간 미확인';
        time.append(reference);
    }
    content.append(time, element('strong', '', entry.name));
    if (entry.classroom) content.append(element('span', '', entry.classroom));
    if (!entry.restrictionOnly) content.append(element('span', 'calendar-usage', usageLabels[entry.usage]));
    card.append(content);
    currentMarkers.push({ node: card, entry, date });
    return card;
}

function createDay(schedule, date, day, position) {
    const column = element('section', 'calendar-day');
    const label = weekdayLabels[weekdayColumns.indexOf(day)];
    column.dataset.day = day;
    column.setAttribute('aria-label', label + '요일');
    const track = element('div', 'calendar-track');
    column.append(element('h3', 'calendar-header', label), track);

    for (const hours of hoursOn(schedule, date).filter(hours => !hours.closed && hours.scheduleConfirmed)) {
        const top = position(hours.start);
        const bottom = position(hours.end);
        if (bottom <= top) continue;
        const block = element('div', 'calendar-open');
        block.setAttribute('aria-hidden', 'true');
        block.style.top = top + '%';
        block.style.height = (bottom - top) + '%';
        track.append(block);
    }

    const laneEnds = [];
    const blocks = [];
    const extra = element('ul', 'calendar-extra');
    for (const entry of entriesOn(schedule, date)) {
        const top = position(entry.start);
        const bottom = position(entry.end);
        if (!(bottom > top)) {
            const line = element('li');
            const reference = hasDates(entry) ? '' : ' · 적용 기간 미확인';
            line.append(element('strong', '', entry.name),
                element('span', '', timeRange(entry) + ' · ' + usageLabels[entry.usage] + reference));
            if (entry.classroom) line.append(element('span', '', entry.classroom));
            extra.append(line);
            continue;
        }

        const end = timeToSeconds(entry.end);
        let lane = laneEnds.findIndex(laneEnd => laneEnd <= timeToSeconds(entry.start));
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = end;
        blocks.push({ entry, lane, top, bottom });
    }
    track.append(...blocks.map(block => createEvent(block, date, laneEnds.length)));
    if (extra.childElementCount) column.append(extra);
    return column;
}

function render(schedule, date) {
    const { displayStartHour: start, displayEndHour: end } = schedule;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 24 || start >= end) {
        throw new Error('Invalid timetable display hours');
    }
    currentMarkers = [];
    currentDate = date;
    todayDate.dateTime = date;
    todayDate.textContent = monthDay(date) + ' (' + weekdayLabels[dayIndex(date)] + ')';
    const entries = entriesOn(schedule, date);
    todayList.replaceChildren(...entries.map(createTodayEntry));
    todayList.hidden = entries.length === 0;
    todayEmpty.hidden = entries.length > 0;
    todayEmpty.textContent = '오늘 표시할 일정이 없습니다. 이용 여부는 위의 운영 안내를 확인하세요.';

    const monday = shiftDate(date, -dayIndex(date));
    document.querySelector('#week-range').textContent =
        monthDay(monday, '.', '') + '–' + monthDay(shiftDate(monday, 4), '.', '');
    const position = time => Math.max(0, Math.min(100, (timeToSeconds(time) / 3600 - start) * 100 / (end - start)));

    const axis = element('div', 'calendar-axis');
    const track = element('div', 'calendar-track');
    axis.append(element('div', 'calendar-header', '시간'), track);
    for (let hour = start; hour <= end; hour++) {
        const tick = element('span', 'calendar-time', String(hour).padStart(2, '0') + ':00');
        tick.style.top = (hour - start) * 100 / (end - start) + '%';
        track.append(tick);
    }

    const plans = weekdayColumns.map((day, index) => createDay(schedule, shiftDate(monday, index), day, position));
    calendar.style.setProperty('--hours', end - start);
    calendar.replaceChildren(axis, ...plans);
    tabs.replaceChildren(...weekdayColumns.map((day, index) => {
        const link = element('a', 'filter', weekdayLabels[index]);
        link.href = './schedule.html?day=' + day + '#week';
        link.dataset.day = day;
        return link;
    }));
    showDay();
    week.hidden = false;
}

tabs.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.replaceState(null, '', link.href);
    showDay();
});

watchSchedule((schedule, now) => {
    if (now.date !== currentDate) render(schedule, now.date);
    for (const { node, entry, date, live } of currentMarkers) {
        const active = isCurrent(entry, date, now);
        node.classList.toggle('is-current', active);
        if (live) live.hidden = !active;
    }
}, () => {
    todayEmpty.textContent = '일정을 불러오지 못했어요. 페이지를 새로고침해 주세요.';
    todayEmpty.hidden = false;
    todayList.hidden = true;
    week.hidden = true;
});
