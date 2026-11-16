/** Iconos de la app: trazo único de 1,75 sobre una rejilla de 24, sin relleno. */
const PATHS = {
  home: 'M3.5 11 12 4l8.5 7M5.5 9.5V20h4.75v-5.5h3.5V20h4.75V9.5',
  layers: 'm12 3.5 8.5 4.25L12 12 3.5 7.75 12 3.5ZM3.5 12 12 16.25 20.5 12M3.5 16.25 12 20.5l8.5-4.25',
  cards: 'M4.6 7.6 12.7 5.4a1.5 1.5 0 0 1 1.84 1.06l2.2 8.2a1.5 1.5 0 0 1-1.06 1.84L7.6 18.7a1.5 1.5 0 0 1-1.84-1.06l-2.2-8.2A1.5 1.5 0 0 1 4.6 7.6ZM16.5 6.5h2a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-.75',
  check: 'M19.5 12.5V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5h8.5M8.5 11l3.25 3.25L20 6',
  chat: 'M12 4.5c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1.1 0-2.2-.2-3.2-.5L4.5 19.5l1.1-3.6C4.3 14.7 3.5 13.2 3.5 11.5c0-3.9 3.8-7 8.5-7ZM8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01',
  calendar: 'M5.5 6h13A1.5 1.5 0 0 1 20 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6ZM4 10.5h16M8.5 3.5v4M15.5 3.5v4',
  chart: 'M5 20v-5M12 20V9M19 20V4',
  flame: 'M12 21c3.6 0 6.5-2.7 6.5-6.3 0-2.6-1.4-4.300-2.900-5.900-.4 1.5-1.200 2.400-2.300 2.900.3-3.200-.9-6.100-3.600-8.200.2 3-1.200 4.800-2.500 6.500C6.100 11.500 5.500 13 5.500 14.700 5.500 18.300 8.400 21 12 21Z',
  arrow: 'M9 5.5 15.5 12 9 18.500',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
