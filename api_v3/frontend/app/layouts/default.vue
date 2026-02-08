<template>
  <div class="min-h-screen flex bg-gray-50 dark:bg-gray-900">
    <!-- 侧边栏 -->
    <aside class="w-16 lg:w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0">
      <div class="h-14 flex items-center justify-center lg:justify-start lg:px-4 border-b border-gray-200 dark:border-gray-700">
        <span class="text-lg font-bold text-indigo-600 dark:text-indigo-400 hidden lg:block">GPT-SoVITS</span>
        <span class="text-lg font-bold text-indigo-600 dark:text-indigo-400 lg:hidden">G</span>
      </div>
      <nav class="flex-1 py-4 space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 lg:px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors"
          :class="[
            $route.path === item.path
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
          ]"
        >
          <span class="text-lg">{{ item.icon }}</span>
          <span class="hidden lg:block">{{ $t(item.label) }}</span>
        </NuxtLink>
      </nav>
      <div class="p-3 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-center lg:justify-start gap-2">
          <div class="w-2 h-2 rounded-full" :class="connected ? 'bg-green-500' : 'bg-red-500'" />
          <span class="text-xs text-gray-500 dark:text-gray-400 hidden lg:block">
            {{ connected ? 'API v3.0' : $t('common.offline') }}
          </span>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 顶栏 -->
      <header class="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 shrink-0">
        <h1 class="text-base font-semibold text-gray-800 dark:text-gray-200">
          {{ currentPageTitle }}
        </h1>
        <div class="flex items-center gap-3">
          <select
            v-model="currentLocale"
            class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            @change="onLocaleChange"
          >
            <option v-for="loc in availableLocales" :key="loc.code" :value="loc.code">
              {{ loc.name }}
            </option>
          </select>
        </div>
      </header>

      <!-- 页面内容 -->
      <main class="flex-1 overflow-auto p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { locale, locales, setLocale, t } = useI18n()

const currentLocale = ref(locale.value)
const connected = ref(false)

const availableLocales = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).map(l => ({
    code: l.code,
    name: l.name,
  }))
)

const navItems = [
  { path: '/', icon: '📊', label: 'nav.home' },
  { path: '/tts', icon: '🎤', label: 'nav.tts' },
  { path: '/config', icon: '⚙️', label: 'nav.settings' },
]

const currentPageTitle = computed(() => {
  const item = navItems.find(n => n.path === route.path)
  return item ? t(item.label) : ''
})

function onLocaleChange() {
  setLocale(currentLocale.value)
}

onMounted(async () => {
  try {
    const api = useApi()
    await api.getHealth()
    connected.value = true
  } catch {
    connected.value = false
  }
})
</script>
