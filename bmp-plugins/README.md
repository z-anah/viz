# bmp-plugins

# Context

I created vue project with pnpm to create tableau plugins

# Structure
```
.
├── README.md
├── eslint.config.js
├── index.html
├── jsconfig.json
├── node_modules
├── package.json
├── pnpm-lock.yaml
├── public
│   ├── favicon.ico
│   └── tableau.extensions.1.latest.min.js
├── src
│   ├── App.vue
│   ├── main.js
│   ├── router
│   │   └── index.js
│   ├── style.css
│   └── views
│       ├── ObmBmpScoreTm.trex
│       └── ObmBmpScoreTm.vue
└── vite.config.js
```
## Package

```
  "dependencies": {
    "@fortawesome/fontawesome-free": "^7.3.1",
    "chart.js": "^4.6.1",
    "vue": "^3.5.42",
    "vue-chartjs": "^5.3.4",
    "vue-router": "^5.3.1"
  },
```

# question

how to add lib of tableau so it can read the trex or something like that.