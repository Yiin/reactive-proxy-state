import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Reactive Proxy State",
  description: "A simple, standalone reactivity library inspired by Vue 3's reactivity system",
  base: '/reactive-proxy-state/', // Base path for GitHub Pages
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'API Reference', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/Yiin/reactive-proxy-state' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Core Concepts', link: '/guide/core-concepts' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'reactive', link: '/api/reactive' },
            { text: 'ref', link: '/api/ref' },
            { text: 'computed', link: '/api/computed' },
            { text: 'watchEffect', link: '/api/watch-effect' },
            { text: 'watch', link: '/api/watch' },
            { text: 'updateState', link: '/api/update-state' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Yiin/reactive-proxy-state' }
    ],

    appearance: true, // show light/dark toggle (enabled by default, but explicit)
    search: {
      provider: 'local'
    }
  }
})
