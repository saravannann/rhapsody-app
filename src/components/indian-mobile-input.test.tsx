import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IndianMobileInput } from './indian-mobile-input';
import { Phone } from 'lucide-react';

describe('IndianMobileInput', () => {
  it('should render the country code +91', () => {
    render(<IndianMobileInput value="" onChange={() => {}} />);
    expect(screen.getByText('+91')).toBeInTheDocument();
  });

  it('should call onChange with normalized digits when typing', () => {
    const handleChange = vi.fn();
    render(<IndianMobileInput value="" onChange={handleChange} />);
    
    const input = screen.getByPlaceholderText('98765 43210');
    fireEvent.change(input, { target: { value: '09876543210' } });
    
    // The component uses nationalDigitsForIndia which strips the leading 0
    expect(handleChange).toHaveBeenCalledWith('9876543210');
  });

  it('should render the LeftIcon if provided', () => {
    const { container } = render(
      <IndianMobileInput value="" onChange={() => {}} LeftIcon={Phone} />
    );
    // Lucide icons often render as svg tags with the correct name/classes
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should be disabled if the disabled prop is true', () => {
    render(<IndianMobileInput value="" onChange={() => {}} disabled />);
    const input = screen.getByPlaceholderText('98765 43210');
    expect(input).toBeDisabled();
  });

  it('should show the correct value', () => {
    render(<IndianMobileInput value="9988776655" onChange={() => {}} />);
    const input = screen.getByDisplayValue('9988776655');
    expect(input).toBeInTheDocument();
  });
});
