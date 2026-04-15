const { DateTime } = require('luxon');

function computeAvailability(busyTimes, startDate, endDate, duration, timeZone) {
    const slots = [];
    let current = DateTime.fromISO(startDate, { zone: timeZone });
    const end = DateTime.fromISO(endDate, { zone: timeZone });
    
    // Convert busy times to DateTime objects once
    const busyIntervals = busyTimes.map(busy => ({
        start: DateTime.fromISO(busy.start, { zone: timeZone }),
        end: DateTime.fromISO(busy.end, { zone: timeZone })
    }));

    while (current.plus({ minutes: duration }) <= end) {
        const slotEnd = current.plus({ minutes: duration });
        let isAvailable = true;

        for (const busy of busyIntervals) {
            // Check if slot overlaps with busy period
            if (current < busy.end && slotEnd > busy.start) {
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

    console.log(`[computeAvailability] Generated ${slots.length} slots of ${duration} minutes each`);
    return slots;
}

module.exports = { computeAvailability };