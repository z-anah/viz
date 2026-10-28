<script setup>
import { ref } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'

const loading = ref(false)
const error = ref('')
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="Plan vs Realization YTD" bgClass="bg-slate-50">
        <div class="flex flex-col justify-between h-full w-full">
            <div class="flex items-center justify-between text-[11px] font-black text-slate-800 uppercase tracking-tight pt-1 mb-2">
                <span>Data Table · Plan vs Realization YTD (same TM Sandy weights)</span>
                <span class="text-[9px] font-normal text-slate-500 italic">Ach. BMP block = YTD achievement of the same activity in BMP block TT 2007 (comparison only, not scored)</span>
            </div>
        </div>
    </PluginLayout>
</template>