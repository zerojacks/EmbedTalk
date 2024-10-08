import React, { useState } from 'react';

interface CloseDialogProps {
  onConfirm: (minimizeToTray: boolean, doNotAskAgain: boolean) => void;
  onCancel: () => void;
}

export const CloseDialog: React.FC<CloseDialogProps> = ({ onConfirm, onCancel }) => {
  const [minimizeToTray, setMinimizeToTray] = useState(false);
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);

  return (
    <div className="dialog">
      <h3>Exit or Minimize to Tray?</h3>
      <div>
        <input
          type="checkbox"
          checked={minimizeToTray}
          onChange={() => setMinimizeToTray(!minimizeToTray)}
        />
        <label>Minimize to tray instead of exiting</label>
      </div>
      <div>
        <input
          type="checkbox"
          checked={doNotAskAgain}
          onChange={() => setDoNotAskAgain(!doNotAskAgain)}
        />
        <label>Do not ask again</label>
      </div>
      <button onClick={() => onConfirm(minimizeToTray, doNotAskAgain)}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
};
