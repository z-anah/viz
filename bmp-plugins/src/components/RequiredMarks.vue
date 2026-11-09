<script setup>
defineProps({
    title: {
        type: String,
        default: 'Plugin Marks Detail Required'
    },
    requiredMarks: {
        type: Array,
        required: true,
        // Format expected: Array of objects [{ fieldName: String, target: String, description: String }]
    },
    manifestUrl: {
        type: String,
        default: ''
    }
})
</script>

<template>
    <div class="w-full h-full flex flex-col items-center justify-center p-6 text-slate-800 box-border overflow-y-auto">
        <div class="max-w-lg w-full border border-[#F1F5F9] p-6 rounded-xl shadow-xs">
            <div class="flex items-center gap-2.5 text-[#006D65] font-bold mb-2 text-xs uppercase tracking-wider">
                <span>{{ title }}</span>
            </div>

            <div class="bg-slate-50 p-3.5 rounded-lg border border-[#F1F5F9] text-xs space-y-2.5 mb-4">
                <div v-for="(mark, idx) in requiredMarks" :key="idx"
                    class="flex justify-between items-center border-b border-[#F1F5F9] pb-2 last:border-0 last:pb-0">
                    <div>
                        <span class="font-bold text-[#00463E] text-[11px]">{{ mark.fieldName }}</span>
                        <span v-if="mark.description" class="block text-[10px] text-slate-500">{{ mark.description
                        }}</span>
                    </div>
                    <span
                        class="text-[11px] font-mono text-[#006D65] px-2.5 py-1 rounded border border-[#F1F5F9] shadow-2xs">
                        {{ mark.target }}
                    </span>
                </div>
            </div>

            <div v-if="manifestUrl"
                class="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-[#F1F5F9] flex items-center justify-between">
                <span class="font-medium text-slate-600">Manifest URL:</span>
                <code class="text-[#006D65] font-mono text-[10px]">{{ manifestUrl }}</code>
            </div>
        </div>
    </div>
</template>