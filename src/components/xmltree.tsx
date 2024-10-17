import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from './Icons';
import fieldDefinitions from '../assets/locales/fieldDefinitions.json';

const definitions: Record<string, string> = fieldDefinitions;

export interface XmlElement {
  name: string;
  attributes: { [key: string]: string };
  value: string | null;
  children: XmlElement[];
}

interface TreeNodeProps {
  node: XmlElement | undefined;
  onUpdate: (updatedNode: XmlElement) => void;
}

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="border textarea-bordered rounded-lg shadow-sm mb-4">
    {children}
  </div>
);

const CardHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-6 py-4 border-b textarea-bordered">
    {children}
  </div>
);

export const CardTitle: React.FC<{ element: XmlElement; className?: string }> = ({ element, className }) => {
  const title = getDisplayName(element.name) + (element.attributes?.id ? ` (${element.attributes.id})` : '');

  return (
    <div className={`flex items-center space-x-2 ${className || ''}`}> {/* 将传入的className应用到最外层div */}
      <h3 className="text-lg font-semibold flex-shrink-0 justify-between-text">
        {title}
      </h3>
      {element.attributes?.protocol && (
        <div className="badge badge-success flex-shrink-0 truncate">
        {element.attributes.protocol}
      </div>
      )}
      {element.attributes?.region && ( // 确保这里检查的是protocol属性，而不是重复region
        <div className="badge badge-info flex-shrink-0 truncate">
          {element.attributes.region}
        </div>
      )}
    </div>
  );
};


const SplitBit: React.FC<{
  element: XmlElement;
  onChange: (value: string) => void;
}> = ({ element, onChange }) => {
  const title = getDisplayName(element.name);
  return (
    <div className='flex items-center'>
      <span className='w-1/4 text-sm font-bold truncate'>
        {title}
      </span>
      <input
        className="input input-bordered w-1/3 min-w-10"
        value={element.attributes?.id}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

const CardContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-6 py-4">
    {children}
  </div>
);

const HorizontalInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center mb-4">
    <label className="w-1/4 text-sm font-medium flex-shrink-0">
      {label}
    </label>
    <input
      className="input input-bordered w-full max-w-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const ValueInput: React.FC<{
  label: string;
  valuekey: string;
  value: string;
  onKeyChange: (key: string) => void;
  onValueChange: (value: string) => void;
}> = ({ label, valuekey, value, onKeyChange, onValueChange }) => (
  <div className="flex items-center mb-4">
    <label className="w-1/4 text-sm font-medium mr-2 flex-shrink-0">
      {label}
    </label>
    <div className="flex max-w-xs w-full">
      <input
        className="input input-bordered w-1/3 min-w-0 mr-2"
        value={valuekey}
        onChange={(e) => onKeyChange(e.target.value)}
      />
      <input
        className="input input-bordered w-2/3 min-w-0"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      />
    </div>
  </div>
);

export const getDisplayName = (name: string, id?: string) => {
  if (id && definitions[id]) {
    return definitions[id];
  } else if(!name) {
    return ''
  }
  return definitions[name] || name;
};

const TreeNode: React.FC<TreeNodeProps> = ({ node, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!node || !node.name) {
    return null;
  }

  const hasChildren = node.children && node.children.length > 0;
  const nodeName = node.name.toLowerCase();

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleChildUpdate = (updatedChild: XmlElement, index: number) => {
    const updatedChildren = [...node.children];
    updatedChildren[index] = updatedChild;
    const updatedNode = { ...node, children: updatedChildren };
    onUpdate(updatedNode);
  };

  const handleValueChange = (newValue: string) => {
    const updatedNode = { ...node, value: newValue };
    onUpdate(updatedNode);
  };

  const handleKeyChange = (newValue: string) => {
    const updatedNode: XmlElement = {
      ...node,
      attributes: {
        ...node.attributes,
        key: newValue
      }
    };
    onUpdate(updatedNode);
  };

  const handleBitChange = (newValue: string) => {
    const updatedNode: XmlElement = {
      ...node,
      attributes: {
        ...node.attributes,
        id: newValue
      }
    };
    onUpdate(updatedNode);
  };

  const renderExpandIcon = () => {
    if (!hasChildren) return null;

    return (
      <button
        onClick={toggleExpand}
        className="mr-2 focus:outline-none"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>
    );
  };

  const renderContent = () => {
    switch (nodeName) {
      case 'dataitem':
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center">
                {renderExpandIcon()}
                <CardTitle element={node} />
              </div>
            </CardHeader>
            {isExpanded && hasChildren && (
              <CardContent>
                {node.children.map((child, index) => (
                  <TreeNode 
                    key={`${child.name}-${index}`} 
                    node={child} 
                    onUpdate={(updatedChild) => handleChildUpdate(updatedChild, index)}
                  />
                ))}
              </CardContent>
            )}
          </Card>
        );
      case 'bit':
        console.log('bit', node, isExpanded, hasChildren);
        return (
          <div>
            <div className="flex items-center">
              {renderExpandIcon()}
              <SplitBit element={node} onChange={handleBitChange} />
            </div>
            {isExpanded && hasChildren && (
              <CardContent>
                {node.children.map((child, index) => (
                  <TreeNode 
                    key={`${child.name}-${index}`} 
                    node={child} 
                    onUpdate={(updatedChild) => handleChildUpdate(updatedChild, index)}
                  />
                ))}
              </CardContent>
            )}
          </div>
        );
      case 'value':
        return (
          <ValueInput
          label={getDisplayName(node.name)}
          valuekey={node.attributes.key}
          value={node.value || ''}
          onKeyChange={handleKeyChange}
          onValueChange={handleValueChange}
        />
        )
      default:
        if (hasChildren) {
          return (
            <div className="mb-4">
              <div className="flex items-center mb-2">
                {renderExpandIcon()}
                <h3 className="text-lg font-semibold">
                  {getDisplayName(node.name)}
                </h3>
              </div>
              {isExpanded && (
                <div className="pl-4">
                  {node.children.map((child, index) => (
                    <TreeNode 
                      key={`${child.name}-${index}`} 
                      node={child} 
                      onUpdate={(updatedChild) => handleChildUpdate(updatedChild, index)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        } else {
          return (
            <HorizontalInput
              label={getDisplayName(node.name)}
              value={node.value || ''}
              onChange={handleValueChange}
            />
          );
        }
    }
  };

  return renderContent();
};

const XmlTree: React.FC<{ data: XmlElement; onUpdate: (updatedData: XmlElement) => void }> = ({ data, onUpdate }) => {
  return (
    <div>
      <TreeNode node={data} onUpdate={onUpdate} />
    </div>
  );
};

export default XmlTree;