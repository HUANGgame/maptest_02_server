package com.example.wififingerprintcollector

import android.content.Context
import android.text.InputFilter
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RatingBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.Locale
import java.util.UUID

internal fun DemoPlace.supportsPlaceReviews(): Boolean = category.trim() in setOf("店家", "商家")

internal class PlaceReviewsDialog(
    private val activity: AppCompatActivity,
    private val baseUrl: String,
    private val mapId: String,
    private val place: DemoPlace,
    private val onSummary: (String) -> Unit = {}
) {
    private val preferences = activity.getSharedPreferences("place_reviews", Context.MODE_PRIVATE)
    private val scopeKey = MessageDigest.getInstance("SHA-256")
        .digest("$baseUrl\n$mapId\n${place.id}".toByteArray()).joinToString("") { "%02x".format(it) }
    private val token: String = preferences.getString("owner_token", null) ?: (
        UUID.randomUUID().toString() + UUID.randomUUID().toString()
    ).replace("-", "").also { preferences.edit().putString("owner_token", it).apply() }

    fun inviteAfterNavigation() {
        if (!place.supportsPlaceReviews()) return
        val previous = preferences.getLong("invited_$scopeKey", 0)
        if (System.currentTimeMillis() - previous < 7L * 24 * 60 * 60 * 1000) return
        if (preferences.getBoolean("reviewed_$scopeKey", false)) return
        preferences.edit().putLong("invited_$scopeKey", System.currentTimeMillis()).apply()
        AlertDialog.Builder(activity)
            .setTitle("為 ${place.name} 留下評論？")
            .setMessage("你的實際體驗可以幫助其他使用者選擇。")
            .setPositiveButton("查看與評論") { _, _ -> show() }
            .setNegativeButton("稍後再說", null)
            .show()
    }

    fun show() {
        if (!place.supportsPlaceReviews()) return
        val content = column()
        val summary = label("正在讀取評分…", 18f)
        val status = label("", 12f)
        val list = column(0)
        val more = Button(activity).apply { text = "載入更多"; visibility = View.GONE }
        content.addView(summary)
        content.addView(label("App 使用者評論 · 最新在前", 13f))
        content.addView(status)
        content.addView(list)
        content.addView(more)
        val dialog = AlertDialog.Builder(activity)
            .setTitle(place.name)
            .setView(ScrollView(activity).apply { addView(content) })
            .setPositiveButton("撰寫評論", null)
            .setNeutralButton("重新整理", null)
            .setNegativeButton("關閉", null)
            .create()
        var mine: JSONObject? = null
        var nextOffset: Int? = null
        var loading = false
        var loadedPages = 1
        var loaded = false

        suspend fun refresh(append: Boolean = false) {
            if (loading || !dialog.isShowing) return
            loading = true
            more.isEnabled = false
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).isEnabled = false
            try {
                val requestedOffset = if (append) nextOffset ?: return else 0
                val pages = if (append) 1 else loadedPages
                val responses = withContext(Dispatchers.IO) {
                    buildList {
                        var offset = requestedOffset
                        repeat(pages) {
                            val result = request("GET", offset = offset)
                            add(result)
                            if (result.isNull("nextOffset")) return@buildList
                            offset = result.getInt("nextOffset")
                        }
                    }
                }
                if (!dialog.isShowing) return
                val first = responses.first()
                val count = first.getInt("count")
                val summaryText = if (count == 0) "尚無評分" else
                    String.format(Locale.TAIWAN, "%.1f / 5 · %d 筆評分", first.getDouble("average"), count)
                summary.text = summaryText
                onSummary(summaryText)
                mine = first.optJSONObject("mine")
                loaded = true
                preferences.edit().putBoolean("reviewed_$scopeKey", mine != null).apply()
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).apply {
                    isEnabled = true
                    text = if (mine == null) "撰寫評論" else "修改我的評論"
                }
                if (!append) list.removeAllViews()
                responses.forEach { response ->
                    val reviews = response.getJSONArray("reviews")
                    for (index in 0 until reviews.length()) {
                        val review = reviews.getJSONObject(index)
                        list.addView(label(
                            "${review.getString("displayName")}${if (review.optBoolean("mine")) "（你）" else ""}", 15f))
                        list.addView(RatingBar(activity, null, android.R.attr.ratingBarStyleSmall).apply {
                            numStars = 5; stepSize = 1f; rating = review.getInt("rating").toFloat(); setIsIndicator(true)
                            contentDescription = "${review.getInt("rating")} 顆星"
                        })
                        val text = review.optString("text")
                        if (text.isNotBlank()) list.addView(label(text, 15f))
                        list.addView(label(review.optString("updatedAt").take(10), 12f))
                        if (!review.optBoolean("mine") && review.optString("id").isNotBlank()) {
                            list.addView(Button(activity).apply {
                                this.text = "檢舉"
                                contentDescription = "檢舉 ${review.optString("displayName")} 的評論"
                                setOnClickListener { reportReview(review.getString("id")) }
                            })
                        }
                        list.addView(View(activity).apply {
                            setBackgroundColor(0xFFD9DEE5.toInt())
                            layoutParams = LinearLayout.LayoutParams(-1, dp(1)).apply { topMargin = dp(8); bottomMargin = dp(12) }
                        })
                    }
                }
                if (count == 0) list.addView(label("目前還沒有使用者留下評論。", 14f))
                nextOffset = responses.last().let { if (it.isNull("nextOffset")) null else it.getInt("nextOffset") }
                if (append) loadedPages++
                more.visibility = if (nextOffset == null) View.GONE else View.VISIBLE
                status.text = if (mine?.optBoolean("hidden") == true) "你的評論已被管理者隱藏，不列入星級統計。" else "已更新"
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                if (dialog.isShowing) {
                    status.text = error.message ?: "讀取失敗，請重新整理。"
                    if (!loaded) summary.text = "暫時無法取得評分"
                }
            } finally {
                loading = false
                more.isEnabled = true
                dialog.getButton(AlertDialog.BUTTON_NEUTRAL)?.isEnabled = true
            }
        }

        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled = false
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                dialog.dismiss()
                edit(mine)
            }
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener {
                activity.lifecycleScope.launch { refresh() }
            }
            more.setOnClickListener { activity.lifecycleScope.launch { refresh(append = true) } }
        }
        dialog.show()
        val updates = activity.lifecycleScope.launch {
            activity.repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (dialog.isShowing) {
                    refresh()
                    delay(30000)
                }
            }
        }
        dialog.setOnDismissListener { updates.cancel() }
    }

    private fun edit(mine: JSONObject?) {
        val draft = preferences.getString("draft_$scopeKey", null)?.let {
            runCatching { JSONObject(it) }.getOrNull()
        } ?: mine
        val content = column()
        val nickname = EditText(activity).apply {
            hint = "暱稱（可不填）"; setSingleLine(true)
            filters = arrayOf(InputFilter.LengthFilter(30))
            setText(draft?.optString("displayName") ?: preferences.getString("nickname", ""))
        }
        val stars = RatingBar(activity).apply {
            numStars = 5; stepSize = 1f; rating = draft?.optInt("rating", 0)?.toFloat() ?: 0f
            contentDescription = "選擇一到五顆星"
        }
        val message = EditText(activity).apply {
            hint = "分享你的體驗（可不填，最多 1000 字）"
            minLines = 3; maxLines = 6
            filters = arrayOf(InputFilter.LengthFilter(1000))
            gravity = android.view.Gravity.TOP
            setText(draft?.optString("text") ?: "")
        }
        val status = label("", 13f)
        content.addView(label("星級", 14f))
        content.addView(stars, LinearLayout.LayoutParams(-2, -2))
        content.addView(nickname)
        content.addView(message)
        content.addView(status)
        val dialog = AlertDialog.Builder(activity)
            .setTitle(if (mine == null) "評論 ${place.name}" else "修改我的評論")
            .setView(ScrollView(activity).apply { addView(content) })
            .setPositiveButton("儲存", null)
            .setNegativeButton("取消", null)
            .apply { if (mine != null) setNeutralButton("刪除評論", null) }
            .create()
        var finished = false
        fun body() = JSONObject().apply {
            put("rating", stars.rating.toInt()); put("displayName", nickname.text.toString().trim())
            put("text", message.text.toString().trim())
        }
        fun saveDraft() { preferences.edit().putString("draft_$scopeKey", body().toString()).apply() }
        fun submit(delete: Boolean) {
            if (!delete && stars.rating < 1f) { status.text = "請先選擇星級。"; return }
            saveDraft()
            val payload = body()
            dialog.setCancelable(false)
            listOf(-1, -2, -3).forEach { dialog.getButton(it)?.isEnabled = false }
            status.text = if (delete) "正在刪除…" else "正在儲存…"
            activity.lifecycleScope.launch {
                try {
                    withContext(Dispatchers.IO) { request(if (delete) "DELETE" else "PUT", payload) }
                    preferences.edit().remove("draft_$scopeKey")
                        .putString("nickname", payload.getString("displayName"))
                        .putBoolean("reviewed_$scopeKey", !delete).apply()
                    finished = true
                    if (dialog.isShowing) { dialog.dismiss(); show() }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Exception) {
                    status.text = error.message ?: "未儲存，請稍後再試。"
                } finally {
                    dialog.setCancelable(true)
                    listOf(-1, -2, -3).forEach { dialog.getButton(it)?.isEnabled = true }
                }
            }
        }
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener { submit(false) }
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL)?.setOnClickListener {
                AlertDialog.Builder(activity).setTitle("刪除你的評論？")
                    .setPositiveButton("刪除") { _, _ -> submit(true) }
                    .setNegativeButton("取消", null).show()
            }
        }
        dialog.setOnDismissListener { if (!finished) saveDraft() }
        dialog.show()
    }

    private fun reportReview(reviewId: String) {
        val reasons = arrayOf("廣告或洗版", "辱罵或不當內容", "不實或無關內容", "洩露個人資料", "其他")
        val codes = arrayOf("advertising", "abuse", "misinformation", "privacy", "other")
        var selected = 0
        AlertDialog.Builder(activity).setTitle("檢舉評論")
            .setSingleChoiceItems(reasons, 0) { _, which -> selected = which }
            .setNegativeButton("取消", null)
            .setPositiveButton("下一步") { _, _ ->
                val content = column()
                val detail = EditText(activity).apply {
                    hint = "補充說明（可不填，最多 200 字）"; minLines = 2
                    filters = arrayOf(InputFilter.LengthFilter(200))
                }
                val status = label("檢舉後交由管理者確認，不會直接刪除評論。", 13f)
                content.addView(detail); content.addView(status)
                val dialog = AlertDialog.Builder(activity).setTitle(reasons[selected])
                    .setView(content).setPositiveButton("送出檢舉", null).setNegativeButton("取消", null).create()
                dialog.setOnShowListener {
                    dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                        val payload = JSONObject().put("reviewId", reviewId).put("reason", codes[selected]).put("detail", detail.text.toString())
                        dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled = false
                        activity.lifecycleScope.launch {
                            try {
                                withContext(Dispatchers.IO) { request("POST", payload, suffix = "/reports") }
                                dialog.dismiss()
                                android.widget.Toast.makeText(activity, "已收到檢舉，等待管理者確認。", android.widget.Toast.LENGTH_LONG).show()
                            } catch (error: CancellationException) { throw error }
                            catch (error: Exception) {
                                status.text = error.message ?: "檢舉未送出，請稍後再試。"
                                dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled = true
                            }
                        }
                    }
                }
                dialog.show()
            }.show()
    }

    private fun request(method: String, body: JSONObject? = null, offset: Int = 0, suffix: String = ""): JSONObject {
        fun encode(value: String) = URLEncoder.encode(value, "UTF-8")
        val endpoint = "${baseUrl.trimEnd('/')}/api/place-reviews$suffix?mapId=${encode(mapId)}&placeId=${encode(place.id)}&offset=$offset"
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            instanceFollowRedirects = false
            connectTimeout = 10000; readTimeout = 10000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", "application/json")
        }
        try {
            if (method == "PUT" || method == "POST") {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val result = runCatching { JSONObject(raw) }.getOrNull()
            if (code !in 200..299) {
                val message = if (code == 404 && result?.optString("error") == "notFound")
                    "評論服務尚未更新，請稍後再試。" else result?.optString("message")?.takeIf { it.isNotBlank() }
                throw IllegalStateException(message ?: "評論服務暫時無法使用（$code）。")
            }
            return result ?: throw IllegalStateException("評論資料格式不正確，請稍後再試。")
        } finally { connection.disconnect() }
    }

    private fun dp(value: Int) = (value * activity.resources.displayMetrics.density).toInt()
    private fun column(padding: Int = 16) = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(padding), dp(padding), dp(padding), dp(padding))
    }
    private fun label(value: String, size: Float) = TextView(activity).apply {
        text = value; textSize = size
        setTextColor(activity.getColor(R.color.text_primary))
        setPadding(0, dp(4), 0, dp(4))
    }
}
