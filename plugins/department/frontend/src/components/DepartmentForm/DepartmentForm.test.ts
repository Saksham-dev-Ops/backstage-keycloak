import { validateDepartment } from './DepartmentForm';

const valid = {
  name: 'Department of Defence',
  ministryId: 'm1',
  userLimit: '500',
  projectLimit: '50',
};

describe('validateDepartment', () => {
  it('accepts valid input', () => {
    expect(Object.values(validateDepartment(valid)).filter(Boolean)).toEqual(
      [],
    );
  });

  it('rejects missing fields and bad limits', () => {
    const errors = validateDepartment({
      name: '',
      ministryId: '',
      userLimit: '0',
      projectLimit: '2.5',
    });
    expect(errors.name).toBe('Department name is required');
    expect(errors.ministryId).toBe('Select a ministry');
    expect(errors.userLimit).toMatch(/at least 1/);
    expect(errors.projectLimit).toMatch(/whole number/);
  });
});
