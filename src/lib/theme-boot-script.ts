/**
 * Script blocking (beforeInteractive) para evitar flash preto
 * antes do CSS e do next-themes hidratarem.
 *
 * - Site público: sempre claro (sem ThemeProvider).
 * - Portal (/portal*): respeita localStorage + prefers-color-scheme.
 * Após o primeiro paint, remove estilos inline para o CSS (.dark) e o
 * toggle de tema funcionarem normalmente.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var p=location.pathname||'';var portal=p==='/portal'||p.indexOf('/portal/')===0;var light='hsl(210 20% 98%)';var darkBg='hsl(215 25% 8%)';if(!portal){d.style.colorScheme='light';d.style.backgroundColor=light}else{var t=null;try{t=localStorage.getItem('theme')}catch(e){}var sys=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=t==='dark'||((t===null||t==='system')&&sys);if(dark){d.classList.add('dark');d.style.colorScheme='dark';d.style.backgroundColor=darkBg}else{d.classList.remove('dark');d.style.colorScheme='light';d.style.backgroundColor=light}}requestAnimationFrame(function(){requestAnimationFrame(function(){d.style.backgroundColor='';d.style.colorScheme=''})})}catch(e){}})();`
