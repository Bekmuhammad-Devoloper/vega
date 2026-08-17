'use client';

/**
 * Root-level error boundary. Root layout/providers ichidagi xato shu yerga
 * tushadi (oddiy error.tsx ushlay olmaydi). Aniq xato matnini ko'rsatamiz
 * ("Application error: client-side exception" generic matni o'rniga).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          fontFamily: 'system-ui, sans-serif',
          background: '#0e1621',
          color: '#e7eef7',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Xatolik yuz berdi</h1>
          <pre
            style={{
              fontSize: 12,
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              maxHeight: '50vh',
              overflow: 'auto',
            }}
          >
            {error?.message || 'Unknown error'}
            {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
            {error?.stack ? `\n\n${error.stack}` : ''}
          </pre>
          <button
            onClick={() => reset()}
            style={{
              background: '#2F6BFF',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Qayta urinish
          </button>
        </div>
      </body>
    </html>
  );
}
