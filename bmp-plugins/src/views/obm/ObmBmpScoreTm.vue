<script setup>
import { ref } from 'vue'
import { useTabData } from '@/composables/useTabData'
import PluginLayout from '@/components/PluginLayout.vue'

const debugLog = ref([])
const addLog = (msg) => {
    debugLog.value.push(`${new Date().toLocaleTimeString()}: ${msg}`)
}

// Define dynamic field mappings for all 6 calculated fields
const fieldMappings = {
    bmpScore: [/cf.*bmp.*score/i, /^bmp score$/i],
    sumatraScore: [/cf.*sumatra.*score/i, /^sumatra score$/i],
    kalimantanScore: [/cf.*kalimantan.*score/i, /^kalimantan score$/i],
    sumatraMoM: [/cf.*sumatra.*mom/i, /sumatra.*mom/i],
    kalimantanMoM: [/cf.*kalimantan.*mom/i, /kalimantan.*mom/i],
    momOverall: [/cf.*mom.*overall/i, /mom.*overall/i, /overall.*mom/i]
}

const { cardData, loading, error, formatPercent, formatMoM } = useTabData(
    {
        bmpScore: null,
        sumatraScore: null,
        kalimantanScore: null,
        sumatraMoM: null,
        kalimantanMoM: null,
        momOverall: null
    },
    fieldMappings,
    addLog
)
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="BMP Score Data">
        <div class="text-[11px] font-bold text-[#00463E] uppercase tracking-tight truncate">
            <span>BMP Score TM</span>
        </div>

        <div class="flex flex-wrap items-baseline justify-between gap-1 my-2 min-w-0">
            <span class="text-2xl sm:text-3xl font-extrabold text-[#F59E0B] tracking-tight shrink-0">
                {{ formatPercent(cardData.bmpScore) }}
            </span>
            <div class="text-right space-y-0.5 text-[10px] sm:text-[11px] font-bold min-w-0">
                <div class="text-[#000000] truncate">
                    Sumatra
                    <span class="font-black text-[#006D65] ml-0.5">{{ formatPercent(cardData.sumatraScore) }}</span>
                    <span :class="cardData.sumatraMoM >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'"
                        class="text-[9px] sm:text-[10px] ml-0.5">
                        <i :class="cardData.sumatraMoM >= 0 ? 'fas fa-caret-up' : 'fas fa-caret-down'"></i>
                        {{ formatMoM(cardData.sumatraMoM) }}
                    </span>
                </div>
                <div class="text-[#000000] truncate">
                    Kalimantan
                    <span class="font-black text-[#006D65] ml-0.5">{{ formatPercent(cardData.kalimantanScore) }}</span>
                    <span :class="cardData.kalimantanMoM >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'"
                        class="text-[9px] sm:text-[10px] ml-0.5">
                        <i :class="cardData.kalimantanMoM >= 0 ? 'fas fa-caret-up' : 'fas fa-caret-down'"></i>
                        {{ formatMoM(cardData.kalimantanMoM) }}
                    </span>
                </div>
            </div>
        </div>

        <div class="pt-2 border-t border-[#E2E8F0] flex items-center justify-between min-w-0">
            <span :class="cardData.momOverall >= 0 ? 'bg-[#D1FAE5] text-[#10B981]' : 'bg-[#FEE2E2] text-[#EF4444]'"
                class="text-[10px] font-bold px-2 py-0.5 rounded-full truncate">
                <i :class="cardData.momOverall >= 0 ? 'fas fa-caret-up' : 'fas fa-caret-down'"></i>
                {{ formatMoM(cardData.momOverall) }} pp MoM
            </span>
        </div>

        <!-- <div class="mt-4 p-2 bg-black/80 text-green-400 text-[9px] font-mono rounded max-h-24 overflow-y-auto">
            <div class="font-bold border-b border-gray-700 mb-1">Debug Console</div>
            <div v-for="(log, index) in debugLog" :key="index">{{ log }}</div>
        </div> -->
    </PluginLayout>
</template>