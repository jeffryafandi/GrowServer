// https://nuxt.com/docs/api/configuration/nuxt-config
import { config } from "@growserver/config";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: [
    '@nuxt/eslint',
    '@nuxt/hints',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/ui',
    "@nuxtjs/i18n",
    "@nuxtjs/turnstile",
    '@vueuse/nuxt',
    "@pinia/nuxt",
    "motion-v/nuxt"
  ],


  devServer: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 3000
  },
  vite: {
    server: {
      allowedHosts: [
        config.web.loginUrl
      ]
    },
  },

  css: ["~/assets/css/main.css"],

  app: {
    head: {
      title: "GrowServer", // default fallback title
      htmlAttrs: {
        lang: "en"
      },
      link: [{ rel: "icon", type: "image/x-icon", href: "/logo.svg" }]
    },
  },

  runtimeConfig: {
    apiExampleKey: "",
    apiDatabaseUrl: "",
    public: {
      betterAuthUrl: "",
      turnstileSiteKey: ""
    },
    turnstile: {
      // This can be overridden at runtime via the NUXT_TURNSTILE_SECRET_KEY
      // environment variable.
      secretKey: ""
    }
  }
})