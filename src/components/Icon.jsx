const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6', back: 'M19 12H5m6-6-6 6 6 6', close: 'm6 6 12 12M6 18 18 6',
  tune: 'M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6',
  bookmark: 'M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1Z',
  share: 'M12 16V3m-4 4 4-4 4 4M6 10H4v11h16V10h-2',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', check: 'm5 12 4 4L19 6', chevron: 'm9 5 7 7-7 7',
  sparkle: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
  search: 'm16 16 5 5M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Z', map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16',
  home: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9', profile: 'M20 21v-2a8 8 0 0 0-16 0v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  menu: 'M5 3h14v18H5ZM9 7h6M9 11h6M9 15h4', info: 'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
}
export default function Icon({ name, size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.pin} /></svg>
}
