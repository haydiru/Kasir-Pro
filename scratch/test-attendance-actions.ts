import { getActiveAttendance, getTodayAttendanceLog } from '../app/actions/attendance';
import { getAvailableShifts } from '../app/actions/attendance-shifts';

async function testActions() {
    console.log("Testing attendance actions...");
    try {
        // We can't easily mock auth() here, but we can see if they throw before auth
        const res1 = await getActiveAttendance();
        console.log("getActiveAttendance success", res1);
    } catch (e) {
        console.error("getActiveAttendance failed", e);
    }

    try {
        const res2 = await getAvailableShifts();
        console.log("getAvailableShifts success", res2);
    } catch (e) {
        console.error("getAvailableShifts failed", e);
    }
}

testActions();
