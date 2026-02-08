<template>
  <div>
    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ label }}</label>
    <input
      :type="type"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs font-mono"
      @input="onInput"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number
  label: string
  type?: string
  min?: number
  max?: number
  step?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', Number(target.value))
}
</script>
