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
    <input
      :value="modelValue"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      class="w-full accent-indigo-600"
      @input="onRangeInput"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number
  label: string
  min?: number
  max?: number
  step?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

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
