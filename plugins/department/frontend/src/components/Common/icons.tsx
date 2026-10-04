import SvgIcon, { SvgIconProps } from '@material-ui/core/SvgIcon';

/** Icons of the design that Material UI v4 does not ship. */
export { BrandMark, GridIcon } from '@internal/backstage-plugin-tenant-react';

export function InvitePendingIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M3 4l17 7.5-7 3M3 4l2.5 7.5L3 19l7-3.1"
      />
      <circle cx="17.5" cy="17.5" r="4.5" fill="currentColor" />
      <path fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" d="M17.5 15.4v2.3l1.5.9" />
    </SvgIcon>
  );
}

export function NoAdminIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" />
        <path d="M4 3l16 18" />
      </g>
    </SvgIcon>
  );
}
