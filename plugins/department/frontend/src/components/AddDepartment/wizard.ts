import { Capability, CreateDepartmentRequest } from '../../types';
import {
  email,
  FieldErrors,
  limit,
  requiredName,
} from '../../utils/validation';

export type AdminDraft = {
  /** Local id, for editing and removing before submission */
  key: string;
  name: string;
  email: string;
  designation: string;
  /** 10 digits, without the +91 country code */
  mobile: string;
};

export type WizardState = {
  ministryId: string;
  name: string;
  shortCode: string;
  capabilities: string[];
  userLimit: string;
  projectLimit: string;
  adminsCanApproveJoinRequests: boolean;
  adminsCanCreateCustomRoles: boolean;
  admins: AdminDraft[];
};

export const COUNTRY_CODE = '+91';

export const INITIAL_STATE: WizardState = {
  ministryId: '',
  name: '',
  shortCode: '',
  capabilities: [],
  userLimit: '500',
  projectLimit: '25',
  adminsCanApproveJoinRequests: true,
  adminsCanCreateCustomRoles: true,
  admins: [],
};

export const STEPS = [
  'Department Details',
  'Department Admin',
  'Review',
] as const;

const SHORT_CODE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

export type DetailsErrors = FieldErrors<
  'ministryId' | 'name' | 'shortCode' | 'capabilities'
>;
export type LimitsErrors = FieldErrors<'userLimit' | 'projectLimit' | 'admins'>;
export type AdminErrors = FieldErrors<
  'name' | 'email' | 'designation' | 'mobile'
>;

export function validateDetails(state: WizardState): DetailsErrors {
  const code = state.shortCode.trim();
  let shortCode: string | undefined;
  if (!code) shortCode = 'Short code is required';
  else if (code.length < 2 || code.length > 20)
    shortCode = 'Short code must be 2 to 20 characters';
  else if (!SHORT_CODE.test(code))
    shortCode = 'Use letters, digits and single dashes only';
  return {
    ministryId: state.ministryId ? undefined : 'Select a ministry',
    name: requiredName(state.name, 'Department name'),
    shortCode,
    capabilities: state.capabilities.length
      ? undefined
      : 'Select at least one area',
  };
}

export function validateLimits(state: WizardState): LimitsErrors {
  const errors: LimitsErrors = {
    userLimit: limit(state.userLimit, 'Maximum users'),
    projectLimit: limit(state.projectLimit, 'Maximum projects'),
    admins: state.admins.length
      ? undefined
      : 'Add at least one Department admin',
  };
  if (!errors.userLimit && state.admins.length > Number(state.userLimit)) {
    errors.userLimit = `Maximum users must allow all ${state.admins.length} admins`;
  }
  return errors;
}

export function validateAdmin(
  admin: Omit<AdminDraft, 'key'>,
  others: AdminDraft[],
): AdminErrors {
  const emailError = email(admin.email);
  const duplicate = others.some(
    o => o.email.trim().toLowerCase() === admin.email.trim().toLowerCase(),
  );
  return {
    name: requiredName(admin.name, 'Full name'),
    email:
      emailError ??
      (duplicate ? 'This admin has already been added' : undefined),
    designation: requiredName(admin.designation, 'Designation'),
    mobile: /^\d{10}$/.test(admin.mobile)
      ? undefined
      : 'Enter a 10-digit mobile number',
  };
}

export function toRequest(state: WizardState): CreateDepartmentRequest {
  return {
    ministryId: state.ministryId,
    name: state.name.trim(),
    shortCode: state.shortCode.trim().toUpperCase(),
    capabilities: state.capabilities,
    userLimit: Number(state.userLimit),
    projectLimit: Number(state.projectLimit),
    adminsCanApproveJoinRequests: state.adminsCanApproveJoinRequests,
    adminsCanCreateCustomRoles: state.adminsCanCreateCustomRoles,
    admins: state.admins.map(a => ({
      name: a.name.trim(),
      email: a.email.trim().toLowerCase(),
      designation: a.designation.trim(),
      mobile: formatMobile(a.mobile),
    })),
  };
}

export function formatMobile(digits: string) {
  return `${COUNTRY_CODE} ${digits}`;
}

/** "Coming soon" tools of the enabled areas, as "A, B and C" */
export function comingSoonSummary(catalog: Capability[], enabled: string[]) {
  const tools = catalog
    .filter(c => enabled.includes(c.id))
    .flatMap(c => c.comingSoon);
  if (tools.length <= 1) return tools.join('');
  return `${tools.slice(0, -1).join(', ')} and ${tools[tools.length - 1]}`;
}

export function isDirty(state: WizardState) {
  return (
    !!state.ministryId ||
    !!state.name ||
    !!state.shortCode ||
    state.admins.length > 0
  );
}
