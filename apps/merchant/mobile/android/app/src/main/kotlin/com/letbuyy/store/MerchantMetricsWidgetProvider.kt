package com.letbuyy.store

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import java.text.NumberFormat
import java.util.Locale

class MerchantMetricsWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { widgetId ->
            appWidgetManager.updateAppWidget(widgetId, buildViews(context))
        }
    }

    companion object {
        private const val storeNameKey = "letbuyy.widget.store_name"
        private const val revenueKey = "letbuyy.widget.revenue"
        private const val ordersKey = "letbuyy.widget.orders"
        private const val productsKey = "letbuyy.widget.products"
        private const val openOrdersKey = "letbuyy.widget.open_orders"
        private const val updatedAtKey = "letbuyy.widget.updated_at"
        private const val sharedPreferencesDoublePrefix =
            "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIGRvdWJsZS4="

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, MerchantMetricsWidgetProvider::class.java)
            val widgetIds = manager.getAppWidgetIds(component)
            widgetIds.forEach { widgetId ->
                manager.updateAppWidget(widgetId, buildViews(context))
            }
        }

        private fun buildViews(context: Context): RemoteViews {
            val snapshot = WidgetSnapshot.load(context)
            val views = RemoteViews(context.packageName, R.layout.merchant_metrics_widget)
            val title = snapshot.storeName.takeIf { it.isNotBlank() } ?: "LetBuyy"
            val subtitle = if (snapshot.hasMetrics) {
                "Last synced from merchant dashboard"
            } else {
                "Open LetBuyy to sync metrics"
            }

            views.setTextViewText(R.id.widget_store_name, title)
            views.setTextViewText(R.id.widget_sync_status, subtitle)
            views.setTextViewText(
                R.id.widget_revenue_value,
                snapshot.revenue?.let(::formatInr) ?: "--",
            )
            views.setTextViewText(
                R.id.widget_open_orders_value,
                snapshot.openOrders?.toString() ?: "--",
            )
            views.setTextViewText(R.id.widget_orders_value, snapshot.orders?.toString() ?: "--")
            views.setTextViewText(R.id.widget_products_value, snapshot.products?.toString() ?: "--")
            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context))
            return views
        }

        private fun openAppIntent(context: Context): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            return PendingIntent.getActivity(context, 0, intent, flags)
        }

        private fun formatInr(amount: Double): String {
            val formatter = NumberFormat.getCurrencyInstance(Locale("en", "IN"))
            formatter.maximumFractionDigits = 0
            return formatter.format(amount)
        }

        private data class WidgetSnapshot(
            val storeName: String,
            val revenue: Double?,
            val orders: Int?,
            val products: Int?,
            val openOrders: Int?,
        ) {
            val hasMetrics: Boolean
                get() = revenue != null || orders != null || products != null || openOrders != null

            companion object {
                fun load(context: Context): WidgetSnapshot {
                    val prefs = context.getSharedPreferences(
                        "FlutterSharedPreferences",
                        Context.MODE_PRIVATE,
                    )
                    return WidgetSnapshot(
                        storeName = prefs.readString(storeNameKey) ?: "",
                        revenue = prefs.readDouble(revenueKey),
                        orders = prefs.readInt(ordersKey),
                        products = prefs.readInt(productsKey),
                        openOrders = prefs.readInt(openOrdersKey),
                    )
                }
            }
        }

        private fun android.content.SharedPreferences.readString(key: String): String? =
            getString("flutter.$key", null) ?: getString(key, null)

        private fun android.content.SharedPreferences.readInt(key: String): Int? =
            (all["flutter.$key"] ?: all[key])?.let { value ->
                when (value) {
                    is Int -> value
                    is Long -> value.toInt()
                    is Number -> value.toInt()
                    is String -> value.toIntOrNull()
                    else -> null
                }
            }

        private fun android.content.SharedPreferences.readDouble(key: String): Double? =
            (all["flutter.$key"] ?: all[key])?.let { value ->
                when (value) {
                    is Double -> value
                    is Float -> value.toDouble()
                    is Long -> java.lang.Double.longBitsToDouble(value)
                    is Number -> value.toDouble()
                    is String -> value
                        .removePrefix(sharedPreferencesDoublePrefix)
                        .toDoubleOrNull()
                    else -> null
                }
            }
    }
}
