import React, { useState, useEffect, useRef } from 'react';

interface SimpleIPInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const SimpleIPInput: React.FC<SimpleIPInputProps> = ({ value, onChange, disabled = false, className = "" }) => {
  // 使用单一的内部状态，不拆分为块
  const [internalValue, setInternalValue] = useState(value || '');
  const skipUpdate = useRef(false);
  
  // 当外部value变化时，更新内部状态
  useEffect(() => {
    if (value !== internalValue && !skipUpdate.current) {
      setInternalValue(value);
    }
    skipUpdate.current = false;
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // 只允许输入数字和点
    if (!/^[0-9.]*$/.test(newValue)) {
      return;
    }
    
    // 更新内部状态
    setInternalValue(newValue);
    
    // 验证IP格式
    if (isValidIP(newValue)) {
      skipUpdate.current = true;
      onChange(newValue);
    }
  };

  // 验证IP地址格式
  const isValidIP = (ip: string): boolean => {
    // 简单验证：检查是否符合IPv4格式
    const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
  };

  return (
    <input
      type="text"
      className={`input input-bordered ${className}`}
      value={internalValue}
      onChange={handleChange}
      disabled={disabled}
      placeholder="0.0.0.0"
    />
  );
};

export default SimpleIPInput;
