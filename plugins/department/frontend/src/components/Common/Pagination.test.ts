import { pageWindow } from './Pagination';

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });

  it('collapses distant pages', () => {
    expect(pageWindow(1, 1500)).toEqual([1, 2, 3, null, 1500]);
    expect(pageWindow(50, 1500)).toEqual([1, null, 49, 50, 51, null, 1500]);
  });
});
