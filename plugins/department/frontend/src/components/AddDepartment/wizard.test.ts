import {
  comingSoonSummary,
  INITIAL_STATE,
  toRequest,
  validateAdmin,
  validateDetails,
  validateLimits,
  WizardState,
} from './wizard';
import { capabilities } from '../../testing/mockDepartmentApi';

const admin = {
  key: 'a1',
  name: 'Priya Sharma',
  email: 'Priya@Example.com',
  designation: 'Intern Designer',
  mobile: '9876543210',
};

const filled: WizardState = {
  ...INITIAL_STATE,
  ministryId: 'm1',
  name: ' DigiLocker ',
  shortCode: 'digi',
  capabilities: ['project-management'],
  admins: [admin],
};

const errorsOf = (errors: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(errors).filter(([, v]) => v));

describe('wizard validation', () => {
  it('requires the department details and at least one area', () => {
    expect(errorsOf(validateDetails(INITIAL_STATE))).toEqual({
      ministryId: 'Select a ministry',
      name: 'Department name is required',
      shortCode: 'Short code is required',
      capabilities: 'Select at least one area',
    });
    expect(errorsOf(validateDetails(filled))).toEqual({});
  });

  it('checks short codes', () => {
    expect(validateDetails({ ...filled, shortCode: 'D' }).shortCode).toMatch(
      /2 to 20/,
    );
    expect(
      validateDetails({ ...filled, shortCode: 'DI GI' }).shortCode,
    ).toMatch(/letters, digits/);
    expect(
      validateDetails({ ...filled, shortCode: 'DIGI-2' }).shortCode,
    ).toBeUndefined();
  });

  it('requires an admin and limits that fit the admins', () => {
    expect(validateLimits({ ...filled, admins: [] }).admins).toBe(
      'Add at least one Department admin',
    );
    expect(validateLimits({ ...filled, userLimit: '0' }).userLimit).toMatch(
      /at least 1/,
    );
    expect(
      validateLimits({
        ...filled,
        userLimit: '1',
        admins: [admin, { ...admin, key: 'a2', email: 'x@y.in' }],
      }).userLimit,
    ).toMatch(/allow all 2 admins/);
    expect(errorsOf(validateLimits(filled))).toEqual({});
  });

  it('validates an admin and prevents duplicates', () => {
    expect(
      errorsOf(
        validateAdmin(
          { name: '', email: 'bad', designation: '', mobile: '123' },
          [],
        ),
      ),
    ).toEqual({
      name: 'Full name is required',
      email: 'Enter a valid email address',
      designation: 'Designation is required',
      mobile: 'Enter a 10-digit mobile number',
    });
    expect(
      validateAdmin({ ...admin, email: 'priya@example.com' }, [admin]).email,
    ).toBe('This admin has already been added');
  });
});

describe('toRequest', () => {
  it('builds the API payload', () => {
    expect(toRequest(filled)).toEqual({
      ministryId: 'm1',
      name: 'DigiLocker',
      shortCode: 'DIGI',
      capabilities: ['project-management'],
      userLimit: 500,
      projectLimit: 25,
      adminsCanApproveJoinRequests: true,
      adminsCanCreateCustomRoles: true,
      admins: [
        {
          name: 'Priya Sharma',
          email: 'priya@example.com',
          designation: 'Intern Designer',
          mobile: '+91 9876543210',
        },
      ],
    });
  });
});

describe('comingSoonSummary', () => {
  it('lists the upcoming tools of enabled areas', () => {
    expect(
      comingSoonSummary(capabilities, ['project-management', 'documentation']),
    ).toBe('Jira and SharePoint links');
    expect(comingSoonSummary(capabilities, ['documentation'])).toBe(
      'SharePoint links',
    );
  });
});
