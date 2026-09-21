/** App version, injected at build time from package.json (see vite.config.ts). Never hardcode versions in the UI. */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
