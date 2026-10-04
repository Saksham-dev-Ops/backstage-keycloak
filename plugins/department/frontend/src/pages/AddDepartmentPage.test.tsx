import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { DepartmentApi, departmentApiRef } from '../api/DepartmentApi';
import { department, mockDepartmentApi } from '../testing/mockDepartmentApi';
import { DepartmentApiError } from '../types';
import { AddDepartmentPage } from './AddDepartmentPage';

const render = (api: DepartmentApi) =>
  renderInTestApp(<AddDepartmentPage />, {
    apis: [[departmentApiRef, api]],
    config: { app: { baseUrl: 'http://localhost:3000' } },
  });

async function fillDetails() {
  await screen.findByText('Project management');
  fireEvent.mouseDown(
    screen.getByRole('button', { name: /Select a ministry/ }),
  );
  await userEvent.click(
    await screen.findByRole('option', {
      name: 'Ministry of Electronics and Information Technology',
    }),
  );
  await userEvent.type(screen.getByLabelText(/Department name/), 'DigiLocker');
  await userEvent.type(screen.getByLabelText(/Short Code/), 'digi');
}

async function addAdmin() {
  await userEvent.click(screen.getByRole('button', { name: 'Add Admin' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(
    within(dialog).getByLabelText(/Full Name/),
    'Priya Sharma',
  );
  await userEvent.type(
    within(dialog).getByLabelText(/Official email/),
    'priya@example.com',
  );
  await userEvent.type(
    within(dialog).getByLabelText(/Designation/),
    'Intern Designer',
  );
  await userEvent.type(
    within(dialog).getByLabelText(/Mobile number/),
    '98765-43210',
  );
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Add Admin' }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
}

describe('AddDepartmentPage', () => {
  it('shows the details step with every area enabled', async () => {
    await render(mockDepartmentApi());
    expect(await screen.findByText('Project management')).toBeInTheDocument();
    expect(screen.getByText('OpenProject')).toBeInTheDocument();
    expect(screen.getByText('Jira')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Project management/ }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Documentation/ }),
    ).toBeChecked();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('validates the details step', async () => {
    const api = mockDepartmentApi();
    await render(api);
    await screen.findByText('Project management');
    await userEvent.click(
      screen.getByRole('checkbox', { name: /Project management/ }),
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /Documentation/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Select a ministry', {
        selector: '[role=alert]',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Department name is required')).toBeInTheDocument();
    expect(screen.getByText('Short code is required')).toBeInTheDocument();
    expect(screen.getByText('Select at least one area')).toBeInTheDocument();
    expect(api.isShortCodeAvailable).not.toHaveBeenCalled();
  });

  it('stops on a short code that is already taken', async () => {
    const api = mockDepartmentApi({
      isShortCodeAvailable: jest.fn().mockResolvedValue(false),
    });
    await render(api);
    await fillDetails();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText(
        'This short code is already used by another department',
      ),
    ).toBeInTheDocument();
    expect(api.isShortCodeAvailable).toHaveBeenCalledWith('DIGI');
  });

  it('walks through all steps and adds the department', async () => {
    const api = mockDepartmentApi({
      createDepartment: jest.fn().mockResolvedValue({
        department,
        invites: [
          {
            userId: 'u9',
            email: 'priya@example.com',
            name: 'Priya Sharma',
            token: 't0k3n',
            expiresAt: '2026-10-11T00:00:00Z',
          },
        ],
      }),
    });
    await render(api);
    await fillDetails();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: no admins yet, so the review cannot be opened
    expect(await screen.findByText('No admins added yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Review Changes' }),
    ).toBeDisabled();

    // The admin dialog validates its fields
    await userEvent.click(screen.getByRole('button', { name: 'Add Admin' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByDisplayValue('DigiLocker')).toBeDisabled();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Add Admin' }),
    );
    expect(
      await within(dialog).findByText('Full name is required'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Enter a 10-digit mobile number'),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    await addAdmin();
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByText('+91 9876543210')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Review Changes' }),
    );

    // Step 3: review
    expect(await screen.findByText('Department details')).toBeInTheDocument();
    expect(screen.getByText('DIGI')).toBeInTheDocument();
    expect(screen.getByText('Department admins (1)')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Not included yet \(Coming Soon\): Jira and SharePoint links/,
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Add Department' }),
    );

    await waitFor(() =>
      expect(api.createDepartment).toHaveBeenCalledWith({
        ministryId: 'm1',
        name: 'DigiLocker',
        shortCode: 'DIGI',
        capabilities: ['project-management', 'documentation'],
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
      }),
    );
    // The one-time invite links are shown once
    expect(
      await screen.findByRole('button', {
        name: 'Copy invite link for Priya Sharma',
      }),
    ).toBeInTheDocument();
  });

  it('sends the user back to the details step if the short code was taken meanwhile', async () => {
    const api = mockDepartmentApi({
      createDepartment: jest
        .fn()
        .mockRejectedValue(
          new DepartmentApiError(
            409,
            'SHORT_CODE_TAKEN',
            'This short code is already used by another department',
          ),
        ),
    });
    await render(api);
    await fillDetails();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('No admins added yet');
    await addAdmin();
    await userEvent.click(
      screen.getByRole('button', { name: 'Review Changes' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add Department' }),
    );
    expect(
      await screen.findByText(
        'This short code is already used by another department',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('What this Department can use'),
    ).toBeInTheDocument();
  });

  it('goes back to a step from the review', async () => {
    await render(mockDepartmentApi());
    await fillDetails();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('No admins added yet');
    await addAdmin();
    await userEvent.click(
      screen.getByRole('button', { name: 'Review Changes' }),
    );
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Edit Limits for the Department admin',
      }),
    );
    expect(
      await screen.findByText('Limits for the Department admin'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Maximum users/)).toHaveValue(500);
  });
});
