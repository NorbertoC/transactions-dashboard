import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

type Props = SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string };

export default function SelectControl({ wrapperClassName = '', children, ...props }: Props) {
  return <span className={`select-control ${wrapperClassName}`}>
    <select {...props}>{children}</select>
    <ChevronDown aria-hidden="true" />
  </span>;
}
