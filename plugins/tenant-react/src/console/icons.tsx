import SvgIcon, { SvgIconProps } from '@material-ui/core/SvgIcon';

/** Shared icons of the admin console design. */

export function GridIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z"
      />
    </SvgIcon>
  );
}

/** The OpenForge mark: two hands in a circle */
export function BrandMark(props: { size?: number }) {
  const size = props.size ?? 54;
  return (
    <svg width={size} height={size} viewBox="0 0 54 54" aria-hidden="true">
      <circle cx="27" cy="27" r="27" fill="#1C4FB8" />
      <path
        fill="#fff"
        d="M10 26l7-6 6 2 4-2 4 1 6-3 7 6-3 3-4-2-6 5c-1.5 1.2-3.4 1-4.6-.3L22 27l-3 2-6-1z"
      />
      <path
        fill="none"
        stroke="#1C4FB8"
        strokeWidth="1.4"
        strokeLinecap="round"
        d="M26 26l4 3.5M29 24.5l4 3.5"
      />
    </svg>
  );
}
