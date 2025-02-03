import React from 'react';
import { useShortcuts, ShortcutKey } from '../context/ShortcutProvider';
import ShortcutInput from '../components/ShortcutInput';
import { HistoryIcon, ShortcutIcon } from '../components/Icons';

export default function ShortcutSetting() {
  const { shortcuts, updateShortcut } = useShortcuts();

  const handleUpdateShortcut = async (key: ShortcutKey, newShortcut: string) => {
    const { success, message } = await updateShortcut(key, newShortcut);
    if (!success) {
      throw new Error(message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ShortcutInput
        icon={<ShortcutIcon className="size-6" />}
        label="显示/隐藏窗口"
        description="快速显示或隐藏应用窗口"
        currentShortcut={shortcuts.toggleWindow}
        onShortcutChange={async (newShortcut) => {
          await handleUpdateShortcut('toggleWindow', newShortcut);
        }}
      />

      <ShortcutInput
        icon={<HistoryIcon className="size-6" />}
        label="打开/关闭 历史记录"
        description="快速打开或关闭历史解析报文记录"
        currentShortcut={shortcuts.toggleHistory}
        onShortcutChange={async (newShortcut) => {
          await handleUpdateShortcut('toggleHistory', newShortcut);
        }}
      />
    </div>
  );
}
