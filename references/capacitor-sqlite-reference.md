# Capacitor SQLite Reference

## Installation
```bash
npm install --save @capacitor-community/sqlite
npx cap sync
```

## capacitor.config.ts Pattern
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.docklogger.app',
  appName: 'DockLogger',
  webDir: 'build',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
    }
  }
};
export default config;
```

## svelte.config.js Pattern (Static Adapter)
```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    })
  }
};
export default config;
```

## Web Platform Notes
- Copy `sql-wasm.wasm` from `node_modules/sql.js/dist/` to static folder
- Web uses jeep-sqlite with IndexedDB storage

## Key Methods
- createConnection
- open
- query
- execute
- importFromJson
- exportToJson
- transaction management
