'use client';
import { useState, type InputHTMLAttributes } from 'react';
import { formatInputNumber } from '@/utils/format';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'type'> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
};
export default function NumericInput({ value, onValueChange, onFocus, onBlur, ...props }: Props) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState('');
  return <input {...props} type="number" value={editing ? draft : formatInputNumber(value)}
    onFocus={event => { setDraft(event.currentTarget.value); setEditing(true); onFocus?.(event); }}
    onChange={event => { const next = event.currentTarget.value; setDraft(next); onValueChange(next === '' ? null : Number(next)); }}
    onBlur={event => { setEditing(false); onBlur?.(event); }} />;
}
