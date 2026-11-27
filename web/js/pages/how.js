// Схемата „Как работи“: генерира се от tools/make_scheme.py; тук само я мащабираме по ширината.
import { onLang, applyStatic } from '../i18n.js';
import { topbar, footer } from '../ui.js';

topbar('how.html');
footer();
const fit = document.getElementById('fit');
function scale() {
  const s = Math.min(1, fit.clientWidth / 2480);
  fit.querySelectorAll('.scheme').forEach(el => { el.style.transform = `scale(${s})`; });
  fit.style.height = 1904 * s + 'px';
}
applyStatic();
scale();
window.addEventListener('resize', scale);
onLang(scale);
