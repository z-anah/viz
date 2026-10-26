<script setup>
import { useTableauData } from '@/composables/useTableauData'
import PluginLayout from '@/components/PluginLayout.vue'

const { cardData, loading, error, formatPercent, initTableau } = useTableauData({
    yieldYtd: 16.10,
    budget: 15.99,
    target: 25.61,
    vsBudget: 100.7,
    vsBudgetPp: 2.0
})

const formatYield = (value) => {
    let num = Number(value)
    if (isNaN(num)) return '0.00'
    if (num > 1000) num = num / 10000
    return num.toFixed(2)
}

const formatPp = (value) => {
    let num = Number(value)
    if (isNaN(num)) return '0.0'
    if (Math.abs(num) > 100) num = num / 100000
    return num.toFixed(1)
}

initTableau((row, columns, targetData, { extractTableauRow }) => {
    extractTableauRow(row, columns, targetData, {
        yieldYtd: [/yield.*ytd/i, /^yield$/i],
        budget: [/budget/i],
        target: [/target/i],
        vsBudget: [/vs.*budget/i],
        vsBudgetPp: [/vs.*budget.*pp/i, /budget.*pp/i]
    })
})
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="Production Yield Data">
        <div class="text-[11px] font-bold text-[#00463E] uppercase tracking-tight truncate">
            Production · Yield YTD
        </div>

        <div class="flex items-center justify-between my-1 min-w-0">
            <div class="min-w-0">
                <div class="text-2xl font-black text-[#000000] leading-none truncate">
                    {{ formatYield(cardData.yieldYtd) }} <span class="text-xs font-normal text-[#00463E]/70">t/ha</span>
                </div>
                <div class="text-[10px] text-[#00463E] font-medium mt-1 truncate">
                    Budget {{ formatYield(cardData.budget) }} t/ha
                </div>
                <div class="text-[9px] text-[#00463E]/60 truncate">
                    Target 2026 {{ formatYield(cardData.target) }} t/ha
                </div>
            </div>

            <div class="text-center shrink-0 ml-2">
                <div
                    class="text-base font-black text-[#006D65] leading-none bg-[#D1FAE5] px-3 py-1.5 rounded border border-[#10B981]">
                    {{ formatPercent(cardData.vsBudget) }}
                </div>
                <div class="text-[8px] text-[#00463E]/70 mt-0.5">
                    vs budget
                </div>
                <div class="text-[9px] font-bold text-[#10B981] mt-0.5 bg-[#D1FAE5] px-1 rounded truncate">
                    <i class="fas fa-caret-up"></i> {{ formatPp(cardData.vsBudgetPp) }} pp
                </div>
            </div>
        </div>
    </PluginLayout>
</template>