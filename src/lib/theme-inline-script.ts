/**
 * Must stay in sync with resolveTheme() in theme.ts (auto branch).
 * Runs synchronously before paint to prevent flash.
 */
export const THEME_INLINE_SCRIPT = `!function(){try{var k='rhapsody_theme_pref';var p=localStorage.getItem(k);var mode='light';if(p==='light')mode='light';else if(p==='dark')mode='dark';else{if(window.matchMedia('(prefers-color-scheme: dark)').matches)mode='dark';else if(window.matchMedia('(prefers-color-scheme: light)').matches)mode='light';else{var h=(new Date).getHours();mode=(h>=19||h<6)?'dark':'light';}}}catch(e){mode='light'}var d=document.documentElement;d.classList.toggle('dark',mode==='dark');d.style.colorScheme=mode==='dark'?'dark':'light';}();`;
