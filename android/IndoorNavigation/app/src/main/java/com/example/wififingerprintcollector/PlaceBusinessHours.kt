package com.example.wififingerprintcollector

import java.time.ZonedDateTime
import java.time.ZoneId

internal object PlaceBusinessHours {
    private data class Hours(val days: Set<Int>, val ranges: List<Pair<Int, Int>>)
    private val interval = Regex("(\\d{1,2}):(\\d{2})\\s*[-~至]\\s*(\\d{1,2}):(\\d{2})")

    fun status(manual: String, text: String, now: ZonedDateTime = ZonedDateTime.now(ZoneId.of("Asia/Taipei"))): String {
        when (manual) {
            "open" -> return "營業中"
            "closed" -> return "休息中"
            "suspended" -> return "暫停服務"
        }
        if (text.isBlank()) return "未設定"
        val schedule = parse(text) ?: return "營業時間待確認"
        val local = now.withZoneSameInstant(ZoneId.of("Asia/Taipei"))
        val day = local.dayOfWeek.value
        val previous = if (day == 1) 7 else day - 1
        val minute = local.hour * 60 + local.minute
        val open = schedule.any { item -> item.ranges.any { (start, end) ->
            if (end > start) day in item.days && minute >= start && minute < end
            else (day in item.days && minute >= start) || (previous in item.days && minute < end)
        } }
        return if (open) "應營業中" else "休息中"
    }

    private fun parse(raw: String): List<Hours>? {
        val text = raw.replace('：', ':').replace('～', '~').replace('－', '-').replace('–', '-')
            .replace(Regex("[（(][^）)]*[）)]")) { match ->
                if (match.value.drop(1).trimStart().startsWith("最後")) "" else match.value
            }.trim()
        if (text in listOf("24小時", "24 小時", "每日24小時", "每日 24 小時", "24H")) {
            return listOf(Hours((1..7).toSet(), listOf(0 to 1440)))
        }
        val result = mutableListOf<Hours>()
        for (line in text.split(Regex("[;；\\n]+"))) {
            if (line.isBlank()) continue
            val matches = interval.findAll(line).toList()
            val prefix = if (matches.isEmpty()) line.trim().removeSuffix("公休").removeSuffix("休息").trim()
                else line.substring(0, matches.first().range.first).trim()
            val days = parseDays(prefix) ?: return null
            if (matches.isEmpty()) {
                if (!line.trim().endsWith("公休") && !line.trim().endsWith("休息")) return null
                result.add(Hours(days, emptyList()))
                continue
            }
            val remainder = interval.replace(line.substring(matches.first().range.first), "")
                .replace(Regex("[\\s、,，/]+"), "")
            if (remainder.isNotBlank()) return null
            val ranges = mutableListOf<Pair<Int, Int>>()
            for (match in matches) {
                val (sh, sm, eh, em) = match.destructured.toList().map(String::toInt)
                if (sh !in 0..23 || eh !in 0..24 || sm !in 0..59 || em !in 0..59 || (eh == 24 && em != 0)) return null
                val start = sh * 60 + sm
                val end = eh * 60 + em
                if (start == end) return null
                ranges.add(start to end)
            }
            result.add(Hours(days, ranges))
        }
        // Overlapping day rules are ambiguous; require one explicit schedule per weekday.
        if (result.isEmpty() || result.flatMap { it.days }.groupingBy { it }.eachCount().values.any { it > 1 }) return null
        return result
    }

    private fun parseDays(raw: String): Set<Int>? {
        val value = raw.replace(Regex("\\s+"), "").replace("星期", "").replace("週", "").replace("周", "")
        if (value in listOf("", "每日", "每天", "一至日", "一至天")) return (1..7).toSet()
        fun day(char: Char): Int? = "一二三四五六日".indexOf(if (char == '天') '日' else char).takeIf { it >= 0 }?.plus(1)
        if (value.length == 3 && value[1] in "至-~") {
            val start = day(value[0]) ?: return null
            val end = day(value[2]) ?: return null
            return if (end >= start) (start..end).toSet() else ((start..7) + (1..end)).toSet()
        }
        val chars = value.filterNot { it in "、,，/" }
        if (chars.isEmpty()) return null
        return chars.map { day(it) ?: return null }.toSet()
    }
}
