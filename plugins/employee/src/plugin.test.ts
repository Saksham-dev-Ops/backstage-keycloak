import { employeePlugin } from './plugin';

describe('employee', () => {
  it('should export plugin', () => {
    expect(employeePlugin).toBeDefined();
  });
});
