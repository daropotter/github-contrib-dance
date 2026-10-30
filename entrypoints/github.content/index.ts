import './style.css';
import { browser } from 'wxt/browser';
import { ROOT_SELECTOR, parseCalendar } from '@/src/calendar';
import { BeatClock } from '@/src/clock';
import { CalendarController } from '@/src/controller';
import type { CalendarInfo, Request } from '@/src/messages';
import { type Settings, effective, loadMotionOk, loadSettings, onMotionOkChanged, onSettingsChanged } from '@/src/settings';

export default defineContentScript({
  matches: ['https://github.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',

  async main(ctx) {
    // Windows high-contrast mode: GitHub's own rendering stays untouched.
    if (matchMedia('(forced-colors: active)').matches) return;

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let settings: Settings = await loadSettings();
    let motionOk = await loadMotionOk();
    const now = () => effective(settings, reducedMotion.matches, motionOk);
    const clock = new BeatClock();
    clock.setBpm(settings.bpm);
    const controllers = new Map<HTMLElement, CalendarController>();
    const applyAll = () => controllers.forEach(c => c.update(now()));

    // GitHub swaps the calendar without page loads (year links replace .js-yearly-contributions, profile tabs
    // swap a turbo-frame), so every scan drops dead controllers and mounts new calendars. Mounting is idempotent.
    const scan = () => {
      for (const [root, c] of controllers) {
        if (c.isStale()) { c.destroy(); controllers.delete(root); }
      }
      document.querySelectorAll<HTMLElement>(ROOT_SELECTOR).forEach(root => {
        if (controllers.has(root)) return;
        const cal = parseCalendar(root);
        if (cal) controllers.set(root, new CalendarController(cal, now(), clock));
      });
    };
    let pending = 0;
    const scheduleScan = () => {
      if (!pending) pending = requestAnimationFrame(() => { pending = 0; scan(); });
    };
    const destroyAll = () => { controllers.forEach(c => c.destroy()); controllers.clear(); };

    const observer = new MutationObserver(records => {
      for (const r of records) {
        if (r.addedNodes.length || r.removedNodes.length) { scheduleScan(); return; }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    for (const e of ['turbo:load', 'turbo:render', 'turbo:frame-load', 'soft-nav:end'])
      ctx.addEventListener(document, e as keyof DocumentEventMap, scheduleScan);
    ctx.addEventListener(window, 'popstate', scheduleScan);
    // Turbo snapshots the page for back/forward; the snapshot must be GitHub's page, not ours.
    ctx.addEventListener(document, 'turbo:before-cache' as keyof DocumentEventMap, destroyAll);

    const stopSettings = onSettingsChanged(next => { settings = next; applyAll(); });
    const stopMotion = onMotionOkChanged(ok => { motionOk = ok; applyAll(); });
    reducedMotion.addEventListener('change', applyAll);

    const onMessage = (msg: Request, _sender: unknown, reply: (info: CalendarInfo) => void) => {
      if (msg?.type === 'cd:preview') {
        settings = msg.settings;                     // also used by calendars mounted before storage catches up
        applyAll();
        return;
      }
      if (msg?.type === 'cd:info') {
        scan();
        const c = [...controllers.values()].find(x => !x.isStale());
        reply(c ? c.info() : { found: false });
      }
    };
    browser.runtime.onMessage.addListener(onMessage as any);

    scan();

    ctx.onInvalidated(() => {
      observer.disconnect();
      stopSettings();
      stopMotion();
      reducedMotion.removeEventListener('change', applyAll);
      browser.runtime.onMessage.removeListener(onMessage as any);
      destroyAll();
    });
  },
});
