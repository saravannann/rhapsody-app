import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CenteredModal } from './centered-modal';

describe('CenteredModal', () => {
  it('should not render anything if open is false', () => {
    const { container } = render(
      <CenteredModal open={false} onClose={() => {}} title="Test" footer={null}>
        Content
      </CenteredModal>
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render title and children when open', () => {
    render(
      <CenteredModal open={true} onClose={() => {}} title="Modal Title" footer={<button>Footer Button</button>}>
        Modal Content
      </CenteredModal>
    );
    expect(screen.getByText('Modal Title')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
    expect(screen.getByText('Footer Button')).toBeInTheDocument();
  });

  it('should call onClose when clicking the close button', () => {
    const handleClose = vi.fn();
    render(
      <CenteredModal open={true} onClose={handleClose} title="Test" footer={null}>
        Content
      </CenteredModal>
    );
    
    const closeBtn = screen.getByLabelText(/Close dialog/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking the backdrop', () => {
    const handleClose = vi.fn();
    render(
      <CenteredModal open={true} onClose={handleClose} title="Test" footer={null}>
        Content
      </CenteredModal>
    );
    
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalled();
  });

  it('should NOT call onClose on backdrop click if closeBlocked is true', () => {
    const handleClose = vi.fn();
    render(
      <CenteredModal open={true} onClose={handleClose} title="Test" footer={null} closeBlocked={true}>
        Content
      </CenteredModal>
    );
    
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('should lock body scroll when open', () => {
    const { unmount } = render(
      <CenteredModal open={true} onClose={() => {}} title="Test" footer={null}>
        Content
      </CenteredModal>
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
