package com.example.wififingerprintcollector

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class WifiResultAdapter : RecyclerView.Adapter<WifiResultAdapter.WifiResultViewHolder>() {
    private val items = mutableListOf<WifiScanResultItem>()

    fun submitResults(results: List<WifiScanResultItem>) {
        items.clear()
        items.addAll(results.sortedByDescending { it.rssi })
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): WifiResultViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_wifi_result, parent, false)
        return WifiResultViewHolder(view)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: WifiResultViewHolder, position: Int) {
        holder.bind(items[position])
    }

    class WifiResultViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val ssid: TextView = itemView.findViewById(R.id.textSsid)
        private val bssid: TextView = itemView.findViewById(R.id.textBssid)
        private val rssi: TextView = itemView.findViewById(R.id.textRssi)
        private val frequency: TextView = itemView.findViewById(R.id.textFrequency)

        fun bind(item: WifiScanResultItem) {
            ssid.text = item.ssid.ifBlank { "Hidden SSID" }
            bssid.text = item.bssid
            rssi.text = "${item.rssi} dBm"
            frequency.text = "${item.frequency} MHz"
        }
    }
}
