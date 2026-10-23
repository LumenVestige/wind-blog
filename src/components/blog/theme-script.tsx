/**
 * Applies the stored (or site default) color scheme before the first paint, so a
 * dark site never flashes white while React hydrates. Must stay in sync with
 * `ThemeToggle` in ./theme-toggle.tsx (same storage key and `dark` class).
 */
export function ThemeScript({ scheme }: { scheme: string }) {
  const fallback = scheme === 'light' || scheme === 'dark' ? scheme : 'system'
  const code = `(function(){try{var m=localStorage.getItem('wind-theme');if(m!=='light'&&m!=='dark'&&m!=='system')m=${JSON.stringify(fallback)};var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}
