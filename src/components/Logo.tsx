/** Símbolo de Studies4Kids: un libro abierto (azul y menta) con un 4 y tres destellos. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <g fill="none" stroke="#ffc857" strokeWidth="7" strokeLinecap="round">
        <path d="M60 8v13M38 13l7 11M82 13l-7 11" />
      </g>
      <g strokeWidth="5" strokeLinejoin="round">
        <path d="M57 46C45 36 29 32 14 34v54c15-2 31 2 43 14z" fill="#4f6df5" stroke="#4f6df5" />
        <path d="M63 46c12-10 28-14 43-12v54c-15-2-31 2-43 14z" fill="#27bfa5" stroke="#27bfa5" />
      </g>
      <path d="M68 90V52L45 79h33" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
