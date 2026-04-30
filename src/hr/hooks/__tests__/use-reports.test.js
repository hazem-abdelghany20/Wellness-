import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../../lib/supabase-hr', () => ({ requestReportExport: vi.fn() }));

import { requestReportExport } from '../../../lib/supabase-hr';
import { useReports } from '../use-reports';

beforeEach(() => { vi.clearAllMocks(); });

describe('useReports', () => {
  it('returns the signed URL after export', async () => {
    requestReportExport.mockResolvedValue({ url: 'https://example.com/r.csv', path: 'p' });
    const { result } = renderHook(() => useReports());
    let res;
    await act(async () => { res = await result.current.exportReport('overview', '30d'); });
    expect(requestReportExport).toHaveBeenCalledWith('overview', '30d');
    expect(res.url).toContain('example.com');
  });
});
