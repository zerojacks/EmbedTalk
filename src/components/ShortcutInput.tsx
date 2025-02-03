import React, { useCallback, useState } from 'react';
import { toast } from '../context/ToastProvider';

interface ShortcutInputProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  currentShortcut: string;
  onShortcutChange: (newShortcut: string) => Promise<void>;
}

export default function ShortcutInput({
  icon,
  label,
  description,
  currentShortcut,
  onShortcutChange
}: ShortcutInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Control');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey) modifiers.push('Meta');

    const keyName = e.key.toUpperCase();
    if (!['CONTROL', 'ALT', 'SHIFT', 'META'].includes(keyName)) {
      const newShortcut = [...modifiers, keyName].join('+');
      try {
        await onShortcutChange(newShortcut);
        setIsEditing(false);
        toast.success('快捷键设置成功');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '快捷键设置失败';
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
      }
    }
  }, [onShortcutChange]);

  return (
    <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
      <div className="collapse-title text-base flex items-center w-full pr-0">
        <div className="flex items-center">
          {icon}
          <p className="ml-2">{label}</p>
        </div>
        <div className="ml-auto flex flex-col items-end mr-3">
          <button
            className={`btn btn-outline btn-sm ${errorMessage ? 'btn-error' : ''}`}
            onClick={() => {
              setIsEditing(true);
              setErrorMessage(null);
            }}
            onKeyDown={e => isEditing && handleKeyDown(e)}
            onBlur={() => {
              setIsEditing(false);
              setErrorMessage(null);
            }}
          >
            {isEditing ? '按下新快捷键...' : currentShortcut}
          </button>
          {errorMessage && (
            <div className="text-error text-sm mt-1">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
