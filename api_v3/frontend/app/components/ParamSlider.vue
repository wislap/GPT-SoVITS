<template>
  <div>
    <label class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
      <span>{{ label }}</span>
      <input
        :value="modelValue"
        type="number"
        :min="min"
        :max="max"
        :step="step"
        class="w-16 text-right rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-1.5 py-0.5 text-xs font-mono"
        @input="onNumberInput"
      />
    </label>
    <div class="relative h-5 flex items-center">
      <input
        :value="modelValue"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        class="w-full accent-indigo-600 absolute inset-0 m-auto"
        @input="onRangeInput"
      />
      <!-- 基准值标记：range thumb 活动范围需要减去两端 padding（约 8px） -->
      <div
        v-if="refValue != null && refPercent >= 0 && refPercent <= 100"
        class="absolute inset-y-0 flex items-center pointer-events-none"
        :style="{ left: `calc(8px + (100% - 16px) * ${refPercent / 100} - 4px)` }"
      >
        <div
          class="w-2 h-2 rounded-full border-2 transition-colors"
          :class="isAtRef
            ? 'border-indigo-400 bg-indigo-400'
            : 'border-gray-400 dark:border-gray-500 bg-transparent'"
          :title="'配置值: ' + refValue"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number
  label: string
  min?: number
  max?: number
  step?: number
  refValue?: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const refPercent = computed(() => {
  if (props.refValue == null) return -1
  const lo = props.min ?? 0
  const hi = props.max ?? 100
  if (hi === lo) return 0
  return ((props.refValue - lo) / (hi - lo)) * 100
})

const isAtRef = computed(() => {
  if (props.refValue == null) return false
  const s = props.step ?? 0.01
  return Math.abs(props.modelValue - props.refValue) < s * 0.5
})

function onRangeInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', Number(target.value))
}

function onNumberInput(event: Event) {
  const target = event.target as HTMLInputElement
  const val = Number(target.value)
  if (!isNaN(val)) {
    emit('update:modelValue', val)
  }
}
</script>
