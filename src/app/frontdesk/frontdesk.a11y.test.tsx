import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import FrontdeskCheckInPage from './page';

expect.extend(toHaveNoViolations);

describe('FrontdeskCheckInPage Accessibility', () => {
  it('should have no basic a11y violations on mount', async () => {
    const { container } = render(<FrontdeskCheckInPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
