import React from 'react';

// Inline-SVG bayroqlar. Emoji bayroqlar (🇺🇿/🇷🇺) Windows brauzerlarida
// "UZ"/"RU" harf sifatida ko'rinadi — shuning uchun haqiqiy SVG ishlatamiz.
const base: React.CSSProperties = {
  display: 'inline-block',
  width: 18,
  height: 13,
  borderRadius: 2,
  verticalAlign: '-2px',
  boxShadow: '0 0 0 0.5px rgba(0,0,0,0.15)',
};

export function FlagUz({ title = "O'zbekiston" }: { title?: string }) {
  return (
    <svg viewBox="0 0 24 16" style={base} role="img" aria-label={title}>
      <title>{title}</title>
      <rect width="24" height="16" fill="#fff" />
      <rect width="24" height="5" fill="#0099B5" />
      <rect y="11" width="24" height="5" fill="#1EB53A" />
      <rect y="5" width="24" height="0.7" fill="#CE1126" />
      <rect y="10.3" width="24" height="0.7" fill="#CE1126" />
      <circle cx="4" cy="2.6" r="1.7" fill="#fff" />
      <circle cx="4.8" cy="2.6" r="1.4" fill="#0099B5" />
    </svg>
  );
}

export function FlagRu({ title = 'Rossiya' }: { title?: string }) {
  return (
    <svg viewBox="0 0 24 16" style={base} role="img" aria-label={title}>
      <title>{title}</title>
      <rect width="24" height="16" fill="#fff" />
      <rect y="5.33" width="24" height="5.33" fill="#0039A6" />
      <rect y="10.66" width="24" height="5.34" fill="#D52B1E" />
    </svg>
  );
}
