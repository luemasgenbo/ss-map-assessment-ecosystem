
import React, { useState, useEffect, useRef } from 'react';

interface EditableFieldProps {
  value: string | undefined;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({ 
  value, 
  onChange, 
  className = "", 
  placeholder, 
  multiline = false, 
  rows = 1,
  disabled = false
}) => {
  const [internalValue, setInternalValue] = useState(value || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setInternalValue(value || '');
  }, [value]);

  useEffect(() => {
    if (multiline && textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [internalValue, multiline]);

  const handleBlur = () => {
    if (disabled) return;
    if (internalValue !== value) {
      onChange(internalValue);
    }
  };

  const commonClasses = `bg-transparent transition-all duration-300 border-dashed border-blue-200/50 focus:border-blue-600 focus:outline-none print:border-none print:bg-transparent ${disabled ? 'cursor-default border-none' : 'hover:bg-blue-50/40 focus:bg-blue-100/50 border-b-2 cursor-text'} ${className}`;

  if (multiline) {
    return (
      <textarea
        ref={textareaRef}
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        className={`${commonClasses} w-full resize-none overflow-hidden block whitespace-pre-wrap break-words leading-relaxed box-border px-2`}
        placeholder={placeholder}
        style={{ boxSizing: 'border-box' }}
        rows={rows}
      />
    );
  }

  return (
    <input
      type="text"
      value={internalValue}
      onChange={(e) => setInternalValue(e.target.value)}
      onBlur={handleBlur}
      disabled={disabled}
      className={`${commonClasses} min-w-0 px-1`}
      placeholder={placeholder}
    />
  );
};

export default EditableField;
