<script setup>
import { useTableauData } from '@/composables/useTableauData'
import PluginLayout from '@/components/PluginLayout.vue'

const { cardData, loading, error, initTableau } = useTableauData({
    onTrack: 12,
    atRisk: 7,
    below: 6
})

initTableau((data, columns, targetData, { findColumn, numericValue }) => {
    const rows = Array.isArray(data) ? data : [data]
    const onTrackIdx = findColumn(columns, [/on.*track/i, /^track$/i])
    const atRiskIdx = findColumn(columns, [/at.*risk/i, /^risk$/i])
    const belowIdx = findColumn(columns, [/^below/i, /under/i, /low/i])

    const categoryCol = findColumn(columns, [/category|class|status|level|measure/i])
    const valueCol = findColumn(columns, [/value|count|estate|score|data/i])

    rows.forEach(row => {
        for (let c = 0; c < columns.length; c++) {
            const colName = String(columns[c].fieldName || columns[c].caption || '').toLowerCase()
            const cellVal = row[c] ? String(row[c].formattedValue ?? row[c].value ?? '').trim().toLowerCase() : ''
            const numVal = numericValue(row[c] ? (row[c].formattedValue ?? row[c].value) : null)

            if (colName.includes('track') || cellVal.includes('track')) {
                if (!isNaN(numVal) && numVal !== 0) targetData.value.onTrack = numVal
            }
            if (colName.includes('risk') || cellVal.includes('risk')) {
                if (!isNaN(numVal) && numVal !== 0) targetData.value.atRisk = numVal
            }
            if (colName.includes('below') || colName.includes('under') || colName.includes('low') || cellVal.includes('below') || cellVal.includes('under') || cellVal.includes('low')) {
                if (!isNaN(numVal)) targetData.value.below = numVal
            }
        }

        if (categoryCol >= 0 && valueCol >= 0 && row[categoryCol] && row[valueCol]) {
            const catVal = String(row[categoryCol].formattedValue ?? row[categoryCol].value).trim().toLowerCase()
            const numVal = numericValue(row[valueCol].formattedValue ?? row[valueCol].value)
            if (!isNaN(numVal)) {
                if (catVal.includes('track')) targetData.value.onTrack = numVal
                if (catVal.includes('risk')) targetData.value.atRisk = numVal
                if (catVal.includes('below') || catVal.includes('under') || catVal.includes('low')) targetData.value.below = numVal
            }
        } else {
            if (onTrackIdx >= 0 && row[onTrackIdx]) {
                const val = numericValue(row[onTrackIdx].formattedValue ?? row[onTrackIdx].value)
                if (!isNaN(val)) targetData.value.onTrack = val
            }
            if (atRiskIdx >= 0 && row[atRiskIdx]) {
                const val = numericValue(row[atRiskIdx].formattedValue ?? row[atRiskIdx].value)
                if (!isNaN(val)) targetData.value.atRisk = val
            }
            if (belowIdx >= 0 && row[belowIdx]) {
                const val = numericValue(row[belowIdx].formattedValue ?? row[belowIdx].value)
                if (!isNaN(val)) targetData.value.below = val
            }
        }
    })
})
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="Yield Status Data">
        <div class="text-[11px] font-bold text-[#00463E] uppercase tracking-tight truncate">
            Yield Status (estates)
        </div>

        <div class="grid grid-cols-3 gap-2 my-1 text-center min-w-0">
            <div class="bg-[#D1FAE5] p-1.5 rounded border border-[#10B981] min-w-0">
                <div class="text-[10px] font-bold text-[#00463E] truncate">On Track</div>
                <div class="text-xl font-black text-[#006D65] leading-none truncate">{{ cardData.onTrack }}</div>
            </div>

            <div class="bg-[#FEF3C7] p-1.5 rounded border border-[#F59E0B] min-w-0">
                <div class="text-[10px] font-bold text-[#F59E0B] truncate">At Risk</div>
                <div class="text-xl font-black text-[#F59E0B] leading-none truncate">{{ cardData.atRisk }}</div>
            </div>

            <div class="bg-[#FEE2E2] p-1.5 rounded border border-[#EF4444] min-w-0">
                <div class="text-[10px] font-bold text-[#EF4444] truncate">Below</div>
                <div class="text-xl font-black text-[#EF4444] leading-none truncate">{{ cardData.below }}</div>
            </div>
        </div>

        <div class="text-[8px] text-[#00463E]/60 truncate">
            ≥100% · 85–99% · &lt; 85% of budget YTD · ton: DIR
        </div>
    </PluginLayout>
</template>