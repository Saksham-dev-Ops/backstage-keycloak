import { useLocation } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { DepartmentApi, departmentApiRef } from '../api/DepartmentApi';
import {
  mockDepartmentApi as mockApi,
  page,
} from '../testing/mockDepartmentApi';
import { DepartmentApiError } from '../types';
import { DepartmentsPage } from './DepartmentsPage';

const render = (api: DepartmentApi) =>
  renderInTestApp(<DepartmentsPage />, { apis: [[departmentApiRef, api]] });

describe('DepartmentsPage', () => {
  it('shows a loading state while departments load', async () => {
    await render(mockApi({ listDepartments: () => new Promise(() => {}) }));
    expect(await screen.findByText('Loading...')).toBeInTheDocument();
  });

  it('renders the departments table', async () => {
    await render(mockApi());
    expect(
      await screen.findByText('Department of Military Affairs'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Departments' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Siddharth Kuradia')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('84 / 500')).toBeInTheDocument();
    expect(screen.getByText('10 / 50')).toBeInTheDocument();
    expect(screen.getByText('of 1 items')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    await render(
      mockApi({ listDepartments: jest.fn().mockResolvedValue(page([])) }),
    );
    expect(await screen.findByText('No departments found')).toBeInTheDocument();
  });

  it('shows an error state with the API message', async () => {
    const error = new DepartmentApiError(
      403,
      'FORBIDDEN',
      'Only platform admins can do this',
    );
    await render(
      mockApi({ listDepartments: jest.fn().mockRejectedValue(error) }),
    );
    expect(
      await screen.findByText('Unable to load departments'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Only platform admins can do this'),
    ).toBeInTheDocument();
  });

  it('sends filters to the API and resets to the first page', async () => {
    const api = mockApi();
    await render(api);
    await screen.findByText('Department of Military Affairs');
    await userEvent.type(
      screen.getByLabelText('Search departments'),
      'military',
    );
    await waitFor(() =>
      expect(api.listDepartments).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'military', page: 1 }),
      ),
    );
  });

  it('opens the multi-step Add Department page', async () => {
    const Location = () => (
      <span data-testid="location">{useLocation().pathname}</span>
    );
    await renderInTestApp(
      <>
        <DepartmentsPage />
        <Location />
      </>,
      { apis: [[departmentApiRef, mockApi()]] },
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /Add Department/ }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/admin/departments/new',
      ),
    );
  });
});
