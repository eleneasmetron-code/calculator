'use client';

import { useState } from 'react';

export default function TelegramButton() {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href="https://t.me/iamspectator"
      target="_blank"
      rel="noopener noreferrer"
      className="telegram-btn"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 22px',
        borderRadius: '9999px',
        background: hovered
          ? 'linear-gradient(135deg, rgba(0, 102, 255, 0.95), rgba(56, 189, 248, 0.95))'
          : 'rgba(10, 14, 26, 0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        boxShadow: hovered
          ? '0 8px 32px rgba(0, 102, 255, 0.4), 0 0 60px rgba(56, 189, 248, 0.15)'
          : '0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(56, 189, 248, 0.05)',
        textDecoration: 'none',
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'translateY(-3px) scale(1.03)' : 'translateY(0) scale(1)',
        animation: 'telegramPulse 3s ease-in-out infinite',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a2.25 2.25 0 0 0 .126 4.073l3.528 1.153 1.536 4.766a1.5 1.5 0 0 0 2.389.625l2.088-1.68 3.574 2.638a2.25 2.25 0 0 0 3.464-1.342l3.3-14.85a2.25 2.25 0 0 0-1.055-2.287ZM9.894 13.108l-.007 3.586a.75.75 0 0 1-.32.596l-2.395 1.548-.67 2.108a.75.75 0 0 1-1.362-.036l-.835-1.97-2.628-.845a.75.75 0 0 1-.456-.652l-.008-.342 4.783-4.002a.75.75 0 0 1 .82-.1Z"
          fill="url(#tgGrad)"
        />
        <defs>
          <linearGradient id="tgGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#0066ff" />
          </linearGradient>
        </defs>
      </svg>
      <span
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: hovered ? 'white' : 'rgba(255,255,255,0.85)',
          whiteSpace: 'nowrap',
          letterSpacing: '0.01em',
        }}
      >
        Заказать проект
      </span>

      <style>{`
        @keyframes telegramPulse {
          0%, 100% {
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 0 40px rgba(56, 189, 248, 0.05);
          }
          50% {
            box-shadow: 0 4px 24px rgba(0, 102, 255, 0.3), 0 0 50px rgba(56, 189, 248, 0.12);
          }
        }

        @media (max-width: 640px) {
          .telegram-btn {
            bottom: 16px !important;
            right: 16px !important;
            padding: 12px 18px !important;
            gap: 8px !important;
          }
          .telegram-btn span {
            font-size: 13px !important;
          }
        }
      `}</style>
    </a>
  );
}
