<script setup>
import { useTableauData } from '@/composables/useTableauData'
import PluginLayout from '@/components/PluginLayout.vue'

const { cardData, loading, error, initTableau } = useTableauData({
    high: 9,
    mid: 5,
    low: 11,
    highDiff: '±0',
    midDiff: '±0',
    lowDiff: '±0'
})

initTableau((data, columns, targetData, { findColumn, numericValue }) => {
    const rows = Array.isArray(data) ? data : [data]
    const highIdx = findColumn(columns, [/^high$/i, /high.*count/i])
    const midIdx = findColumn(columns, [/^mid$/i, /mid.*count/i])
    const lowIdx = findColumn(columns, [/^low$/i, /low.*count/i])
    const highDiffIdx = findColumn(columns, [/high.*diff/i, /high.*vs/i])
    const midDiffIdx = findColumn(columns, [/mid.*diff/i, /mid.*vs/i])
    const lowDiffIdx = findColumn(columns, [/low.*diff/i, /low.*vs/i])

    const categoryCol = findColumn(columns, [/category|class|status|level/i])
    const valueCol = findColumn(columns, [/value|count|estate|score/i])

    rows.forEach(row => {
        if (categoryCol >= 0 && valueCol >= 0 && row[categoryCol]) {
            const catVal = String(row[categoryCol].formattedValue ?? row[categoryCol].value).trim().toLowerCase()
            const numVal = numericValue(row[valueCol].formattedValue ?? row[valueCol].value)
            if (!isNaN(numVal)) {
                if (catVal.includes('high')) targetData.value.high = numVal
                if (catVal.includes('mid')) targetData.value.mid = numVal
                if (catVal.includes('low')) targetData.value.low = numVal
            }
        } else {
            if (highIdx >= 0 && row[highIdx]) {
                const val = numericValue(row[highIdx].formattedValue ?? row[highIdx].value)
                if (!isNaN(val)) targetData.value.high = val
            }
            if (midIdx >= 0 && row[midIdx]) {
                const val = numericValue(row[midIdx].formattedValue ?? row[midIdx].value)
                if (!isNaN(val)) targetData.value.mid = val
            }
            if (lowIdx >= 0 && row[lowIdx]) {
                const val = numericValue(row[lowIdx].formattedValue ?? row[lowIdx].value)
                if (!isNaN(val)) targetData.value.low = val
            }
        }

        if (highDiffIdx >= 0 && row[highDiffIdx]) {
            targetData.value.highDiff = row[highDiffIdx].formattedValue ?? String(row[highDiffIdx].value)
        }
        if (midDiffIdx >= 0 && row[midDiffIdx]) {
            targetData.value.midDiff = row[midDiffIdx].formattedValue ?? String(row[midDiffIdx].value)
        }
        if (lowDiffIdx >= 0 && row[lowDiffIdx]) {
            targetData.value.lowDiff = row[lowDiffIdx].formattedValue ?? String(row[lowDiffIdx].value)
        }
    })
})
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="Distribution Data">
        <div class="text-[11px] font-bold text-[#00463E] uppercase tracking-tight truncate">
            Distribution TM (estates)
        </div>

        <div class="grid grid-cols-3 gap-2 my-1 text-center min-w-0">
            <div class="bg-[#D1FAE5] p-1 rounded border border-[#10B981] min-w-0">
                <div class="text-[10px] font-bold text-[#00463E] truncate">High</div>
                <div class="text-lg font-black text-[#006D65] leading-none truncate">
                    {{ cardData.high }}<span class="text-[10px] text-[#00463E]/70 font-normal">/25</span>
                </div>
                <div class="text-[8px] text-[#00463E]/70 mt-0.5 truncate">{{ cardData.highDiff }} vs Jul</div>
            </div>

            <div class="bg-[#FEF3C7] p-1 rounded border border-[#F59E0B] min-w-0">
                <div class="text-[10px] font-bold text-[#F59E0B] truncate">Mid</div>
                <div class="text-lg font-black text-[#F59E0B] leading-none truncate">
                    {{ cardData.mid }}<span class="text-[10px] text-[#00463E]/70 font-normal">/25</span>
                </div>
                <div class="text-[8px] text-[#00463E]/70 mt-0.5 truncate">{{ cardData.midDiff }} vs Jul</div>
            </div>

            <div class="bg-[#FEE2E2] p-1 rounded border border-[#EF4444] min-w-0">
                <div class="text-[10px] font-bold text-[#EF4444] truncate">Low</div>
                <div class="text-lg font-black text-[#EF4444] leading-none truncate">
                    {{ cardData.low }}<span class="text-[10px] text-[#00463E]/70 font-normal">/25</span>
                </div>
                <div class="text-[8px] text-[#00463E]/70 mt-0.5 truncate">{{ cardData.lowDiff }} vs Jul</div>
            </div>
        </div>

        <div class="text-[8px] text-[#00463E]/60 truncate">
            High ≥ 80% · Mid 75–80% · Low &lt; 75% (usulan)
        </div>
    </PluginLayout>
</template>