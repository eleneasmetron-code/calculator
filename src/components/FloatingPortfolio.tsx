'use client';

// ── SVG Mockup Generators ──

function svgLanding(c1: string, c2: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
<rect fill="#0f172a" width="320" height="200" rx="8"/>
<rect fill="#1e293b" x="0" y="0" width="320" height="22" rx="8"/>
<rect fill="${c1}" x="8" y="6" width="10" height="10" rx="5"/>
<rect fill="#334155" x="22" y="8" width="25" height="6" rx="3"/>
<rect fill="#334155" x="50" y="8" width="25" height="6" rx="3"/>
<rect fill="#334155" x="78" y="8" width="25" height="6" rx="3"/>
<rect fill="${c1}" opacity="0.1" x="0" y="22" width="320" height="88"/>
<rect fill="#e2e8f0" x="30" y="40" width="150" height="10" rx="3"/>
<rect fill="#94a3b8" x="30" y="55" width="110" height="6" rx="2"/>
<rect fill="#94a3b8" x="30" y="64" width="80" height="6" rx="2"/>
<rect fill="${c1}" x="30" y="78" width="70" height="20" rx="10"/>
<rect fill="${c2}" x="210" y="34" width="80" height="66" rx="8" opacity="0.6"/>
<rect fill="#1e293b" x="15" y="120" width="85" height="60" rx="6"/>
<rect fill="#1e293b" x="108" y="120" width="85" height="60" rx="6"/>
<rect fill="#1e293b" x="201" y="120" width="85" height="60" rx="6"/>
<circle fill="${accent}" cx="57" cy="140" r="7" opacity="0.4"/>
<circle fill="${c1}" cx="150" cy="140" r="7" opacity="0.4"/>
<circle fill="${c2}" cx="243" cy="140" r="7" opacity="0.4"/>
<rect fill="#334155" x="32" y="155" width="50" height="4" rx="2"/>
<rect fill="#334155" x="125" y="155" width="50" height="4" rx="2"/>
<rect fill="#334155" x="218" y="155" width="50" height="4" rx="2"/>
<rect fill="#334155" x="32" y="163" width="35" height="3" rx="1"/>
<rect fill="#334155" x="125" y="163" width="35" height="3" rx="1"/>
<rect fill="#334155" x="218" y="163" width="35" height="3" rx="1"/>
</svg>`;
}

function svgDashboard(c1: string, c2: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
<rect fill="#0f172a" width="320" height="200" rx="8"/>
<rect fill="#1e293b" x="0" y="0" width="65" height="200" rx="8"/>
<circle fill="${c1}" cx="32" cy="22" r="11"/>
<rect fill="#334155" x="12" y="44" width="42" height="5" rx="2"/>
<rect fill="${c1}" opacity="0.2" x="8" y="58" width="50" height="20" rx="6"/>
<rect fill="#e2e8f0" x="14" y="64" width="38" height="5" rx="2" opacity="0.9"/>
<rect fill="#334155" x="14" y="88" width="38" height="5" rx="2"/>
<rect fill="#334155" x="14" y="102" width="38" height="5" rx="2"/>
<rect fill="#334155" x="14" y="116" width="38" height="5" rx="2"/>
<rect fill="#334155" x="14" y="130" width="38" height="5" rx="2"/>
<rect fill="#1e293b" x="72" y="4" width="244" height="20" rx="6"/>
<rect fill="#1e293b" x="72" y="30" width="76" height="46" rx="6"/>
<rect fill="#1e293b" x="152" y="30" width="76" height="46" rx="6"/>
<rect fill="#1e293b" x="232" y="30" width="84" height="46" rx="6"/>
<rect fill="${c1}" opacity="0.15" x="72" y="30" width="76" height="46" rx="6"/>
<rect fill="${c2}" opacity="0.15" x="152" y="30" width="76" height="46" rx="6"/>
<rect fill="${accent}" opacity="0.15" x="232" y="30" width="84" height="46" rx="6"/>
<rect fill="#e2e8f0" x="80" y="38" width="30" height="5" rx="2" opacity="0.7"/>
<rect fill="#e2e8f0" x="160" y="38" width="30" height="5" rx="2" opacity="0.7"/>
<rect fill="#e2e8f0" x="240" y="38" width="30" height="5" rx="2" opacity="0.7"/>
<rect fill="#e2e8f0" x="80" y="50" width="50" height="12" rx="2" opacity="0.5"/>
<rect fill="#e2e8f0" x="160" y="50" width="50" height="12" rx="2" opacity="0.5"/>
<rect fill="#e2e8f0" x="240" y="50" width="50" height="12" rx="2" opacity="0.5"/>
<rect fill="#1e293b" x="72" y="82" width="244" height="112" rx="6"/>
<rect fill="${c1}" x="88" y="150" width="20" height="36" rx="3" opacity="0.7"/>
<rect fill="${c1}" x="116" y="132" width="20" height="54" rx="3" opacity="0.5"/>
<rect fill="${c2}" x="144" y="118" width="20" height="68" rx="3" opacity="0.7"/>
<rect fill="${c2}" x="172" y="140" width="20" height="46" rx="3" opacity="0.5"/>
<rect fill="${c1}" x="200" y="106" width="20" height="80" rx="3" opacity="0.7"/>
<rect fill="${accent}" x="228" y="124" width="20" height="62" rx="3" opacity="0.5"/>
<rect fill="${c1}" x="256" y="98" width="20" height="88" rx="3" opacity="0.7"/>
<rect fill="#334155" x="88" y="92" width="60" height="5" rx="2"/>
</svg>`;
}

function svgShop(c1: string, c2: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
<rect fill="#0f172a" width="320" height="200" rx="8"/>
<rect fill="#1e293b" x="0" y="0" width="320" height="24" rx="8"/>
<rect fill="${c1}" x="8" y="6" width="12" height="12" rx="3"/>
<rect fill="#334155" x="28" y="8" width="40" height="6" rx="3"/>
<rect fill="#334155" x="200" y="8" width="25" height="6" rx="3"/>
<rect fill="#334155" x="230" y="8" width="25" height="6" rx="3"/>
<rect fill="${c1}" x="264" y="6" width="45" height="12" rx="6"/>
<rect fill="#1e293b" x="12" y="32" width="90" height="120" rx="8"/>
<rect fill="${c2}" x="20" y="40" width="74" height="56" rx="4" opacity="0.25"/>
<rect fill="#94a3b8" x="20" y="102" width="50" height="5" rx="2"/>
<rect fill="#e2e8f0" x="20" y="112" width="30" height="5" rx="2" opacity="0.6"/>
<rect fill="${c1}" x="20" y="124" width="45" height="16" rx="8"/>
<rect fill="#1e293b" x="112" y="32" width="90" height="120" rx="8"/>
<rect fill="${c1}" x="120" y="40" width="74" height="56" rx="4" opacity="0.25"/>
<rect fill="#94a3b8" x="120" y="102" width="50" height="5" rx="2"/>
<rect fill="#e2e8f0" x="120" y="112" width="30" height="5" rx="2" opacity="0.6"/>
<rect fill="${c1}" x="120" y="124" width="45" height="16" rx="8"/>
<rect fill="#1e293b" x="212" y="32" width="96" height="120" rx="8"/>
<rect fill="${accent}" x="220" y="40" width="80" height="56" rx="4" opacity="0.2"/>
<rect fill="#94a3b8" x="220" y="102" width="50" height="5" rx="2"/>
<rect fill="#e2e8f0" x="220" y="112" width="30" height="5" rx="2" opacity="0.6"/>
<rect fill="${c1}" x="220" y="124" width="45" height="16" rx="8"/>
<rect fill="#1e293b" x="12" y="160" width="296" height="30" rx="8"/>
<rect fill="#334155" x="20" y="170" width="80" height="5" rx="2"/>
<rect fill="${c1}" x="240" y="166" width="60" height="18" rx="9"/>
</svg>`;
}

function svgMobile(c1: string, c2: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
<rect fill="#0f172a" width="320" height="200" rx="8"/>
<rect fill="#1e293b" x="110" y="8" width="100" height="184" rx="16"/>
<rect fill="#0f172a" x="115" y="14" width="90" height="172" rx="12"/>
<rect fill="${c1}" x="115" y="14" width="90" height="44" rx="12"/>
<rect fill="${c1}" x="115" y="46" width="90" height="12" opacity="0"/>
<circle fill="white" cx="160" cy="30" r="6" opacity="0.3"/>
<rect fill="white" x="128" y="42" width="64" height="4" rx="2" opacity="0.5"/>
<rect fill="#1e293b" x="123" y="66" width="74" height="30" rx="8"/>
<rect fill="#334155" x="131" y="72" width="40" height="4" rx="2"/>
<rect fill="#334155" x="131" y="80" width="55" height="3" rx="1"/>
<rect fill="#1e293b" x="123" y="102" width="74" height="30" rx="8"/>
<rect fill="#334155" x="131" y="108" width="40" height="4" rx="2"/>
<rect fill="#334155" x="131" y="116" width="55" height="3" rx="1"/>
<rect fill="${c2}" x="123" y="138" width="74" height="24" rx="12" opacity="0.3"/>
<rect fill="white" x="140" y="146" width="40" height="5" rx="2" opacity="0.5"/>
<rect fill="#1e293b" x="123" y="170" width="74" height="10" rx="5"/>
<circle fill="${c1}" cx="138" cy="175" r="3" opacity="0.5"/>
<circle fill="${accent}" cx="160" cy="175" r="3" opacity="0.5"/>
<circle fill="#334155" cx="182" cy="175" r="3"/>
<rect fill="${c1}" opacity="0.08" x="20" y="40" width="76" height="120" rx="8"/>
<rect fill="${c2}" opacity="0.08" x="224" y="40" width="76" height="120" rx="8"/>
<rect fill="#334155" x="28" y="50" width="60" height="5" rx="2" opacity="0.3"/>
<rect fill="#334155" x="28" y="60" width="45" height="3" rx="1" opacity="0.2"/>
<rect fill="#334155" x="232" y="50" width="60" height="5" rx="2" opacity="0.3"/>
<rect fill="#334155" x="232" y="60" width="45" height="3" rx="1" opacity="0.2"/>
</svg>`;
}

function svgBot(c1: string, c2: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
<rect fill="#0f172a" width="320" height="200" rx="8"/>
<rect fill="#1e293b" x="0" y="0" width="320" height="28" rx="8"/>
<circle fill="${c1}" cx="18" cy="14" r="8"/>
<rect fill="#e2e8f0" x="32" y="10" width="50" height="5" rx="2" opacity="0.7"/>
<rect fill="#334155" x="32" y="18" width="30" height="3" rx="1"/>
<rect fill="${c1}" x="150" y="42" width="150" height="28" rx="14"/>
<rect fill="white" x="162" y="52" width="100" height="5" rx="2" opacity="0.5"/>
<rect fill="#1e293b" x="20" y="80" width="170" height="36" rx="14"/>
<rect fill="#94a3b8" x="32" y="90" width="120" height="5" rx="2"/>
<rect fill="#94a3b8" x="32" y="100" width="80" height="4" rx="2" opacity="0.6"/>
<rect fill="${c1}" x="130" y="126" width="170" height="28" rx="14" opacity="0.85"/>
<rect fill="white" x="142" y="136" width="120" height="5" rx="2" opacity="0.5"/>
<rect fill="#1e293b" x="20" y="164" width="280" height="28" rx="14"/>
<rect fill="#334155" x="34" y="174" width="180" height="5" rx="2"/>
<circle fill="${c2}" cx="282" cy="178" r="10" opacity="0.6"/>
</svg>`;
}

function svgCode(c1: string, c2: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
<rect fill="#0f172a" width="320" height="200" rx="8"/>
<rect fill="#1e293b" x="0" y="0" width="320" height="18" rx="8"/>
<circle fill="#ff5f57" cx="14" cy="9" r="5"/>
<circle fill="#ffbd2e" cx="30" cy="9" r="5"/>
<circle fill="#28ca42" cx="46" cy="9" r="5"/>
<rect fill="#334155" x="60" y="4" width="35" height="10" rx="3"/>
<rect fill="#475569" x="98" y="4" width="35" height="10" rx="3"/>
<rect fill="#1e293b" x="0" y="18" width="50" height="182"/>
<rect fill="#334155" x="6" y="28" width="38" height="4" rx="2" opacity="0.6"/>
<rect fill="${c1}" x="6" y="38" width="38" height="10" rx="3" opacity="0.2"/>
<rect fill="#e2e8f0" x="10" y="41" width="30" height="4" rx="2" opacity="0.5"/>
<rect fill="#334155" x="6" y="54" width="38" height="4" rx="2"/>
<rect fill="#334155" x="6" y="64" width="38" height="4" rx="2"/>
<rect fill="#334155" x="6" y="74" width="38" height="4" rx="2"/>
<rect fill="#475569" x="58" y="26" width="30" height="4" rx="1"/>
<rect fill="${c1}" x="58" y="36" width="80" height="4" rx="1" opacity="0.7"/>
<rect fill="#94a3b8" x="70" y="46" width="120" height="4" rx="1"/>
<rect fill="${c2}" x="70" y="56" width="60" height="4" rx="1" opacity="0.6"/>
<rect fill="#94a3b8" x="70" y="66" width="100" height="4" rx="1"/>
<rect fill="${accent}" x="58" y="76" width="40" height="4" rx="1" opacity="0.5"/>
<rect fill="#94a3b8" x="70" y="86" width="140" height="4" rx="1"/>
<rect fill="${c1}" x="70" y="96" width="90" height="4" rx="1" opacity="0.5"/>
<rect fill="#94a3b8" x="82" y="106" width="110" height="4" rx="1"/>
<rect fill="${c2}" x="82" y="116" width="70" height="4" rx="1" opacity="0.6"/>
<rect fill="#94a3b8" x="70" y="126" width="80" height="4" rx="1"/>
<rect fill="#475569" x="58" y="136" width="50" height="4" rx="1"/>
<rect fill="${c1}" x="58" y="146" width="100" height="4" rx="1" opacity="0.4"/>
<rect fill="#94a3b8" x="70" y="156" width="130" height="4" rx="1"/>
<rect fill="${accent}" x="70" y="166" width="60" height="4" rx="1" opacity="0.5"/>
<rect fill="#94a3b8" x="58" y="176" width="90" height="4" rx="1"/>
<rect fill="#94a3b8" x="58" y="186" width="70" height="4" rx="1"/>
</svg>`;
}

// ── Mockup Data ──

interface ScreenshotItem {
  type: 'landing' | 'dashboard' | 'shop' | 'mobile' | 'bot' | 'code';
  c1: string;
  c2: string;
  accent: string;
  angle: number;
  dist: number;
  size: number;
  duration: number;
  delay: number;
  rotate: number;
  xPct: number;
  yPct: number;
}

const ITEMS: ScreenshotItem[] = [
  // Landings
  { type: 'landing', c1: '#0066ff', c2: '#38bdf8', accent: '#ff6b6b', angle: 15, dist: 480, size: 260, duration: 22, delay: 0, rotate: -3, xPct: 88.37, yPct: 68.44 },
  { type: 'landing', c1: '#38bdf8', c2: '#0066ff', accent: '#ffffff', angle: 145, dist: 520, size: 200, duration: 26, delay: -4, rotate: 2, xPct: 14.26, yPct: 82.73 },
  { type: 'landing', c1: '#ff6b6b', c2: '#0066ff', accent: '#38bdf8', angle: 260, dist: 440, size: 170, duration: 20, delay: -8, rotate: -2, xPct: 43.61, yPct: 3.17 },
  { type: 'landing', c1: '#0066ff', c2: '#ffffff', accent: '#38bdf8', angle: 340, dist: 550, size: 130, duration: 28, delay: -12, rotate: 4, xPct: 93.1, yPct: 31.23 },
  // Dashboards / CRM
  { type: 'dashboard', c1: '#0066ff', c2: '#38bdf8', accent: '#ff6b6b', angle: 55, dist: 500, size: 240, duration: 24, delay: -2, rotate: 2, xPct: 73.92, yPct: 95.96 },
  { type: 'dashboard', c1: '#38bdf8', c2: '#ff6b6b', accent: '#0066ff', angle: 190, dist: 460, size: 180, duration: 21, delay: -6, rotate: -4, xPct: 11.56, yPct: 40.97 },
  { type: 'dashboard', c1: '#ffffff', c2: '#0066ff', accent: '#38bdf8', angle: 305, dist: 530, size: 150, duration: 27, delay: -10, rotate: 1, xPct: 75.33, yPct: 13.58 },
  // Shops / E-commerce
  { type: 'shop', c1: '#0066ff', c2: '#38bdf8', accent: '#ff6b6b', angle: 85, dist: 470, size: 220, duration: 23, delay: -1, rotate: -2, xPct: 53.42, yPct: 102.21 },
  { type: 'shop', c1: '#ff6b6b', c2: '#38bdf8', accent: '#0066ff', angle: 215, dist: 510, size: 190, duration: 25, delay: -5, rotate: 3, xPct: 15.09, yPct: 20.76 },
  { type: 'shop', c1: '#38bdf8', c2: '#0066ff', accent: '#ffffff', angle: 330, dist: 480, size: 140, duration: 19, delay: -9, rotate: -1, xPct: 91.57, yPct: 23.33 },
  // Mobile Apps
  { type: 'mobile', c1: '#0066ff', c2: '#38bdf8', accent: '#ff6b6b', angle: 35, dist: 520, size: 160, duration: 26, delay: -3, rotate: 5, xPct: 85.5, yPct: 82.93 },
  { type: 'mobile', c1: '#38bdf8', c2: '#ff6b6b', accent: '#0066ff', angle: 165, dist: 490, size: 200, duration: 22, delay: -7, rotate: -3, xPct: 9.01, yPct: 63.73 },
  { type: 'mobile', c1: '#ffffff', c2: '#0066ff', accent: '#38bdf8', angle: 280, dist: 540, size: 120, duration: 29, delay: -11, rotate: 2, xPct: 59.36, yPct: -10.64 },
  // Telegram Bots
  { type: 'bot', c1: '#38bdf8', c2: '#0066ff', accent: '#ff6b6b', angle: 110, dist: 500, size: 210, duration: 24, delay: -2, rotate: -4, xPct: 32.87, yPct: 102.21 },
  { type: 'bot', c1: '#0066ff', c2: '#ff6b6b', accent: '#38bdf8', angle: 240, dist: 470, size: 160, duration: 20, delay: -6, rotate: 3, xPct: 30.42, yPct: 4.77 },
  { type: 'bot', c1: '#ff6b6b', c2: '#38bdf8', accent: '#0066ff', angle: 10, dist: 530, size: 130, duration: 27, delay: -14, rotate: -1, xPct: 94.09, yPct: 60.24 },
  // Code / API
  { type: 'code', c1: '#38bdf8', c2: '#0066ff', accent: '#ff6b6b', angle: 70, dist: 490, size: 230, duration: 25, delay: -4, rotate: 2, xPct: 63.96, yPct: 101.33 },
  { type: 'code', c1: '#0066ff', c2: '#38bdf8', accent: '#ffffff', angle: 175, dist: 540, size: 170, duration: 21, delay: -8, rotate: -3, xPct: 5.07, yPct: 54.7 },
  { type: 'code', c1: '#ff6b6b', c2: '#0066ff', accent: '#38bdf8', angle: 295, dist: 460, size: 140, duration: 28, delay: -12, rotate: 1, xPct: 66.2, yPct: 3.68 },
  { type: 'code', c1: '#38bdf8', c2: '#ffffff', accent: '#0066ff', angle: 230, dist: 550, size: 110, duration: 30, delay: -15, rotate: -5, xPct: 14.62, yPct: 11.87 },
];

const generators: Record<string, (c1: string, c2: string, accent: string) => string> = {
  landing: svgLanding,
  dashboard: svgDashboard,
  shop: svgShop,
  mobile: svgMobile,
  bot: svgBot,
  code: svgCode,
};

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function FloatingPortfolio() {
  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2,
        overflow: 'hidden',
      }}
    >
      {ITEMS.map((s, i) => (
        <div
          key={i}
          className="portfolio-float"
          style={{
            position: 'absolute',
            left: `${s.xPct}%`,
            top: `${s.yPct}%`,
            width: s.size,
            ['--base-rotate' as string]: `${s.rotate}deg`,
            ['--float-duration' as string]: `${s.duration}s`,
            transform: `translate(-50%, -50%) rotate(${s.rotate}deg)`,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
            opacity: s.size > 200 ? 0.45 : s.size > 150 ? 0.35 : 0.25,
            filter: s.size < 130 ? 'blur(1.5px)' : 'none',
          }}
        >
          <img
            src={svgToDataUrl(generators[s.type](s.c1, s.c2, s.accent))}
            alt=""
            width={s.size}
            height={Math.round(s.size * 0.625)}
            style={{
              borderRadius: 8,
              border: '1px solid rgba(56, 189, 248, 0.15)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 102, 255, 0.08)',
              display: 'block',
            }}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}
