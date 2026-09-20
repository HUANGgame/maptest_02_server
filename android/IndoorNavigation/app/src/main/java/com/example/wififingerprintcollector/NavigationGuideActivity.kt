package com.example.wififingerprintcollector

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class NavigationGuideActivity : AppCompatActivity() {
    private data class Page(val image: Int, val title: String, val description: String, val tips: List<String>)
    private val pages = listOf(
        Page(R.drawable.guide_hold, "拿穩手機，再出發", "螢幕朝上、頂端朝前，保持自然穩定的拿法。", listOf(
            "開啟 Wi-Fi 與定位服務，允許 App 所需權限。",
            "不要反覆甩動手機；方向異常時，先遠離磁性物品再確認。",
            "進入地圖後會自動定位；需要重試時，按「定位」。",
            "拿法有助方向穩定，但定位仍受訊號與環境影響。行走時注意前方。")),
        Page(R.drawable.guide_search, "找到想去的店", "輸入店名、設施或關鍵字，再從清單選擇目的地。", listOf(
            "點店家查看名稱、樓層、營業時間與距離。",
            "「應營業中」依時間推估，實際以店家現場公告為準。",
            "只有店家／商家提供星級與評論；可修改或刪除自己的評論。",
            "遇到廣告或不當評論，可以檢舉；導航結束後也可分享實際體驗。")),
        Page(R.drawable.guide_route, "先看路線，再開始導航", "按「顯示路線」預覽，按「開始導航」才播放路線動畫。", listOf(
            "箭頭是目前位置；下方顯示目的地、剩餘距離與預估時間。",
            "點 1F／2F 查看樓層，用 +／− 放大縮小，拖曳查看地圖。",
            "「固定／跟轉」切換地圖方向；「定位」重新確認目前位置。",
            "到達或不再需要引導時，按「結束導航」。請依現場可通行動線行走。")),
        Page(R.drawable.guide_help, "需要協助時", "先在設定填好 SOS 收件人與姓名，再使用求助功能。", listOf(
            "SOS 會準備位置與地圖圖片；開啟 Email 後，仍要由你確認寄出。",
            "SOS 不是緊急救援派遣，也不代表收件人已收到或會即時回覆。",
            "設定可回報問題、調整箭頭與線條、更新點位及重新傳送暫存回報。",
            "設定也可調整後端連線、選擇是否協助改善定位、刪除導航紀錄，或重看操作說明。"))
    )
    private var page = 0
    private val replay get() = intent.getBooleanExtra("replay", false)
    private lateinit var image: ImageView
    private lateinit var title: TextView
    private lateinit var description: TextView
    private lateinit var tips: LinearLayout
    private lateinit var progress: TextView
    private lateinit var previous: Button
    private lateinit var next: Button
    private lateinit var scroll: ScrollView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!replay && getSharedPreferences("navigation_guide", MODE_PRIVATE).getBoolean("seen_v1", false)) {
            finishGuide(); return
        }
        page = (savedInstanceState?.getInt("page") ?: 0).coerceIn(pages.indices)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.WHITE) }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left + dp(20), bars.top + dp(8), bars.right + dp(20), bars.bottom + dp(12)); insets
        }
        val top = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        top.addView(label("操作說明", 16f), LinearLayout.LayoutParams(0, -2, 1f))
        top.addView(Button(this).apply { text = "跳過"; setOnClickListener { finishGuide() } })
        root.addView(top)
        scroll = ScrollView(this).apply { isFillViewport = true }
        val body = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        image = ImageView(this).apply {
            scaleType = ImageView.ScaleType.FIT_CENTER
            layoutParams = LinearLayout.LayoutParams(-1, dp((resources.configuration.screenHeightDp * .34f).toInt().coerceIn(140, 300)))
        }
        val gestures = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent) = true
            override fun onFling(e1: MotionEvent?, e2: MotionEvent, velocityX: Float, velocityY: Float): Boolean {
                val dx = e2.x - (e1?.x ?: e2.x)
                if (kotlin.math.abs(dx) < dp(64) || kotlin.math.abs(velocityX) < kotlin.math.abs(velocityY)) return false
                page = (page + if (dx < 0) 1 else -1).coerceIn(pages.indices); render(); return true
            }
        })
        image.setOnTouchListener { _, event -> gestures.onTouchEvent(event) }
        title = label("", 25f).apply { setTypeface(typeface, android.graphics.Typeface.BOLD) }
        description = label("", 16f)
        tips = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        body.addView(image); body.addView(title); body.addView(description); body.addView(tips)
        scroll.addView(body); root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        progress = label("", 14f).apply { gravity = Gravity.CENTER; accessibilityLiveRegion = android.view.View.ACCESSIBILITY_LIVE_REGION_POLITE }
        root.addView(progress)
        val controls = LinearLayout(this)
        previous = Button(this).apply { text = "上一張"; setOnClickListener { page--; render() } }
        next = Button(this).apply { setOnClickListener { if (page == pages.lastIndex) finishGuide() else { page++; render() } } }
        controls.addView(previous, LinearLayout.LayoutParams(0, -2, 1f))
        controls.addView(next, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(controls); setContentView(root); render()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (page > 0) { page--; render() } else finishGuide() }
        })
    }

    private fun render() {
        val current = pages[page]
        image.setImageResource(current.image); image.contentDescription = current.description
        title.text = current.title; description.text = current.description
        tips.removeAllViews()
        current.tips.forEachIndexed { index, text -> tips.addView(label("${index + 1}. $text", 15f)) }
        progress.text = "${page + 1} / ${pages.size}"
        previous.isEnabled = page > 0
        next.text = if (page == pages.lastIndex) "開始使用" else "下一張"
        scroll.post { scroll.scrollTo(0, 0) }
    }

    private fun finishGuide() {
        getSharedPreferences("navigation_guide", MODE_PRIVATE).edit().putBoolean("seen_v1", true).apply()
        if (!replay) startActivity(Intent(this, UserNavigationActivity::class.java))
        finish()
    }
    override fun onSaveInstanceState(outState: Bundle) { outState.putInt("page", page); super.onSaveInstanceState(outState) }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun label(value: String, size: Float) = TextView(this).apply {
        text = value; textSize = size; setTextColor(Color.rgb(31, 41, 55)); setPadding(0, dp(7), 0, dp(7))
    }
}
