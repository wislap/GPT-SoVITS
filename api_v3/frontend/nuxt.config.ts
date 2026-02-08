// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/i18n',
  ],

  i18n: {
    locales: [
      { code: 'zh-CN', name: '简体中文', file: 'zh-CN.json' },
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'ja', name: '日本語', file: 'ja.json' },
      { code: 'ko', name: '한국어', file: 'ko.json' },
    ],
    defaultLocale: 'zh-CN',
    lazy: true,
    langDir: 'locales',
    strategy: 'no_prefix',
    vueI18n: './i18n/i18n.config.ts',
    detectBrowserLanguage: false,
  },

  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE || '/api/v3',
    },
  },

  nitro: {
    devProxy: {
      '/api/v3': {
        target: 'http://127.0.0.1:9881/api/v3',
        changeOrigin: true,
      },
      '/api/v2': {
        target: 'http://127.0.0.1:9881/api/v2',
        changeOrigin: true,
      },
    },
  },
})
