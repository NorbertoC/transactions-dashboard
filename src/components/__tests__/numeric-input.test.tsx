import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import NumericInput from '../NumericInput';
it('limits unfocused presentation while preserving internal precision and the active editing draft', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container), onValueChange = vi.fn();
  const render = (value: number) => act(() => root.render(<NumericInput value={value} onValueChange={onValueChange} />));
  render(5840.800041); const field = container.querySelector('input')!; expect(field.value).toBe('5840.8');
  act(() => { field.focus(); field.blur(); }); expect(onValueChange).not.toHaveBeenCalled();
  act(() => { field.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '123.456789'); field.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(onValueChange).toHaveBeenLastCalledWith(123.456789); render(123.456789); expect(field.value).toBe('123.456789');
  render(9999.12345); expect(field.value).toBe('123.456789'); expect(document.activeElement).toBe(field);
  act(() => field.blur()); expect(field.value).toBe('9999.12'); expect(onValueChange).toHaveBeenCalledTimes(1);
  act(() => root.unmount()); container.remove(); vi.unstubAllGlobals();
});
