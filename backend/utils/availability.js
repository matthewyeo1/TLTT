const { DateTime } = require('luxon');

function computeAvailability(busyTimes, startDate, endDate, duration, timeZone) {
    const slots = [];
    let current = DateTime.fromISO(startDate, { zone: timeZone });
    const end = DateTime.fromISO(endDate, { zone: timeZone });

    while (current.plus({ minutes: duration }) <= end) {
        const slotEnd = current.plus({ minutes: duration });
        let isAvailable = true;

        for (const busyTime of busyTimes) {
            const busyStart = DateTime.fromISO(busyTime.start, { zone: timeZone });
            const busyEnd = DateTime.fromISO(busyTime.end, { zone: timeZone });

            if (current < busyEnd && slotEnd > busyStart) {
                isAvailable = false;
                break;
            }
        }

        if (isAvailable) {
            slots.push({
                start: current.toISO(),
                end: slotEnd.toISO()
            });
        }

        current = slotEnd;
    }

    return slots;
}

module.exports = { computeAvailability };