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

export const CardTitle: React.FC<{ element: XmlElement }> = ({ element }) => {
  const title = getDisplayName(element.name) + (element.attributes?.id ? ` (${element.attributes.id})` : '');

  return (
    <div className="flex items-center space-x-2 bg-transparent"> {/* 使用space-x-2来添加横向间距 */}
      <h3 className="text-lg font-semibold">
        {title}
      </h3>
      {element.attributes.region && (
        <div className="badge badge-success">
          {element.attributes.region}
        </div>
      )}
      {element.attributes.protocol && ( // 确保这里检查的是protocol属性，而不是重复region
        <div className="badge badge-success">
          {element.attributes.protocol}
        </div>
      )}
    </div>
  );
};
const SplitBit: React.FC<{ element: XmlElement }> = ({ element }) => {
  const title = getDisplayName(element.name) + (element.attributes?.id ? ` (${element.attributes.id})` : '');
  return (
    <div>
      <h3 className='w-1/4 text-sm font-medium'>
        {title}
      </h3>
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
    <label className="w-1/4 text-sm font-medium">
      {label}
    </label>
    <input
      className="input input-bordered w-full max-w-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const getDisplayName = (name: string, id?: string) => {
  if (id && definitions[id]) {
    return definitions[id];
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
        return (
          <div>
            <SplitBit element={node} />
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