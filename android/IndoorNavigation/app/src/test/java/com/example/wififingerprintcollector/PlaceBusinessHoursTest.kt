package com.example.wififingerprintcollector

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.ZonedDateTime

class PlaceBusinessHoursTest {
    private fun status(hours: String, time: String, manual: String = "unset") =
        PlaceBusinessHours.status(manual, hours, ZonedDateTime.parse(time))

    @Test fun dailyBoundariesAndTaipeiTime() {
        assertEquals("休息中", status("每日 11:00-22:00", "2026-09-16T10:59:00+08:00"))
        assertEquals("應營業中", status("每日 11:00-22:00", "2026-09-16T03:00:00Z"))
        assertEquals("休息中", status("每日 11:00-22:00", "2026-09-16T22:00:00+08:00"))
    }
    @Test fun notesAreNotAnExtraOpeningPeriod() {
        assertEquals("應營業中", status("每日 11:00-22:00（最後點餐 20:30）", "2026-09-16T21:00:00+08:00"))
    }
    @Test fun splitShiftsAndDays() {
        val hours = "週一至週五 11:00-14:00、17:00-22:00；週六、日 12:00-23:00"
        assertEquals("休息中", status(hours, "2026-09-16T15:00:00+08:00"))
        assertEquals("應營業中", status(hours, "2026-09-19T22:30:00+08:00"))
    }
    @Test fun overnightUsesTheOpeningDay() {
        val hours = "週五 22:00-02:00"
        assertEquals("應營業中", status(hours, "2026-09-19T01:00:00+08:00"))
        assertEquals("休息中", status(hours, "2026-09-19T02:00:00+08:00"))
        assertEquals("休息中", status(hours, "2026-09-19T23:00:00+08:00"))
    }
    @Test fun manualStatusWins() {
        assertEquals("暫停服務", status("24小時", "2026-09-16T12:00:00+08:00", "suspended"))
        assertEquals("休息中", status("24小時", "2026-09-16T12:00:00+08:00", "closed"))
        assertEquals("營業中", status("", "2026-09-16T12:00:00+08:00", "open"))
    }
    @Test fun neverGuessMalformedOrConditionalHours() {
        for (hours in listOf("依現場公告", "每日 25:00-26:00", "11:00-22:00 週一公休", "11:00-22:00（週一公休）", "假日 11:00-22:00", "每日 11:00-11:00")) {
            assertEquals(hours, "營業時間待確認", status(hours, "2026-09-16T12:00:00+08:00"))
        }
        assertEquals("未設定", status("", "2026-09-16T12:00:00+08:00"))
    }
    @Test fun closedDaysAndMidnight() {
        assertEquals("休息中", status("週一公休；週二至日 11:00-24:00", "2026-09-14T15:00:00+08:00"))
        assertEquals("應營業中", status("週一公休；週二至日 11:00-24:00", "2026-09-16T23:59:00+08:00"))
        assertEquals("應營業中", status("24小時", "2026-09-16T00:00:00+08:00"))
    }
}
