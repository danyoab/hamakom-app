// Lightweight loading skeletons. The shimmer + cream palette live in
// index.html (.hm-skeleton) so these stay pure markup.

export function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
  return (
    <div
      className="hm-skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  )
}

// Matches the Explore <Card> footprint: 4:3 image block + two text lines.
export function SkeletonCard() {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #EBE2D0',
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      aria-hidden="true"
    >
      <div className="hm-skeleton" style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 0 }} />
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <Skeleton width="80%" height={13} />
        <Skeleton width="50%" height={11} />
      </div>
    </div>
  )
}

// A grid of skeleton cards sized to the Explore list layout.
// `label` feeds an SR-only live region so screen readers still hear a
// "loading" announcement — the skeleton cards themselves are aria-hidden.
export function SkeletonCardGrid({ count = 6, label }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
