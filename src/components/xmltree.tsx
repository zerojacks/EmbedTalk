import React, { useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/card';
import fieldDefinitions from '../assets/locales/fieldDefinitions.json';

const definitions: Record<string, string> = fieldDefinitions;

export interface XmlElement {
  name: string;
  attributes: { [key: string]: string };
  value: string | null;
  children: XmlElement[];
}

interface DraggableNodeProps {
  node: XmlElement;
  index: number;
  moveNode: (dragIndex: number, hoverIndex: number) => void;
  onUpdate: (updatedNode: XmlElement) => void;
  onAddChild: (parentNode: XmlElement, newNodeType: string) => void;
}

const gernetKey = (node: XmlElement) => {
  let key = node.attributes.id;
  if(node.attributes.protocol) {
    key = key + node.attributes.protocol;
  } 
  if(node.attributes.region) {
    key = key + node.attributes.region;
  }
  return key;
}

export const getDisplayName = (name: string, id?: string) => {
  if (id && definitions[id]) {
    return definitions[id];
  } else if (!name) {
    return '';
  }
  return definitions[name] || name;
};

const NodeTypes = {
  DATAITEM: 'dataitem',
  BIT: 'bit',
  VALUE: 'value',
};

const DraggableNode: React.FC<DraggableNodeProps> = ({ node, index, moveNode, onUpdate, onAddChild }) => {
  const [{ isDragging }, drag, preview] = useDrag({
    type: 'NODE',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'NODE',
    hover(item: { index: number }) {
      if (item.index !== index) {
        moveNode(item.index, index);
        item.index = index;
      }
    },
  });

  const opacity = isDragging ? 0.5 : 1;

  return (
    <div ref={(node) => preview(drop(node))} style={{ opacity }}>
      <div className="flex items-center">
        <div ref={drag} className="cursor-move mr-2">
          <GripVertical size={16} />
        </div>
        <NodeContent node={node} onUpdate={onUpdate} onAddChild={onAddChild} />
      </div>
    </div>
  );
};

const NodeContent: React.FC<{ node: XmlElement; onUpdate: (updatedNode: XmlElement) => void; onAddChild: (parentNode: XmlElement, newNodeType: string) => void }> = ({ node, onUpdate, onAddChild }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const handleValueChange = (newValue: string) => {
    const updatedNode = { ...node, value: newValue };
    onUpdate(updatedNode);
  };

  const handleChildUpdate = (updatedChild: XmlElement, index: number) => {
    const updatedChildren = [...node.children];
    updatedChildren[index] = updatedChild;
    const updatedNode = { ...node, children: updatedChildren };
    onUpdate(updatedNode);
  };

  const moveChild = (dragIndex: number, hoverIndex: number) => {
    console.log("movechild", dragIndex, hoverIndex);
    const updatedChildren = [...node.children];
    const [reorderedItem] = updatedChildren.splice(dragIndex, 1);
    updatedChildren.splice(hoverIndex, 0, reorderedItem);
    const updatedNode = { ...node, children: updatedChildren };
    onUpdate(updatedNode);
  };
  if(!node.name) {
    return;
  }
  switch (node.name.toLowerCase()) {
    case NodeTypes.DATAITEM:
      return (
        <DataItemNode 
          node={node} 
          isExpanded={isExpanded} 
          toggleExpand={toggleExpand} 
          onUpdate={onUpdate} 
          onAddChild={onAddChild} 
          moveChild={moveChild}
          handleChildUpdate={handleChildUpdate}
        />
      );
    case NodeTypes.BIT:
      return (
        <BitNode 
          node={node} 
          isExpanded={isExpanded} 
          toggleExpand={toggleExpand} 
          onUpdate={onUpdate} 
          onAddChild={onAddChild} 
          moveChild={moveChild}
          handleChildUpdate={handleChildUpdate}
        />
      );
    default:
      return <ValueNode node={node} onValueChange={handleValueChange} />;
  }
};

const DataItemNode: React.FC<{ 
  node: XmlElement; 
  isExpanded: boolean; 
  toggleExpand: () => void; 
  onUpdate: (updatedNode: XmlElement) => void; 
  onAddChild: (parentNode: XmlElement, newNodeType: string) => void; 
  moveChild: (dragIndex: number, hoverIndex: number) => void;
  handleChildUpdate: (updatedChild: XmlElement, index: number) => void;
}> = ({ node, isExpanded, toggleExpand, onUpdate, onAddChild, moveChild, handleChildUpdate }) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center">
          <button onClick={toggleExpand} className="mr-2 focus:outline-none">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <h3 className="text-lg font-semibold">
            {getDisplayName(node.name)} {node.attributes?.id ? `(${node.attributes.id})` : ''}
          </h3>
          {node.attributes?.region && (
            <div className="badge badge-success ml-2">{node.attributes.region}</div>
          )}
          {node.attributes?.protocol && (
            <div className="badge badge-success ml-2">{node.attributes.protocol}</div>
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <NodeList 
            nodes={node.children} 
            onUpdate={handleChildUpdate} 
            onAddChild={onAddChild} 
            moveNode={moveChild} 
          />
        </CardContent>
      )}
    </Card>
  );
};

const BitNode: React.FC<{ 
  node: XmlElement; 
  isExpanded: boolean; 
  toggleExpand: () => void; 
  onUpdate: (updatedNode: XmlElement) => void; 
  onAddChild: (parentNode: XmlElement, newNodeType: string) => void; 
  moveChild: (dragIndex: number, hoverIndex: number) => void;
  handleChildUpdate: (updatedChild: XmlElement, index: number) => void;
}> = ({ node, isExpanded, toggleExpand, onUpdate, onAddChild, moveChild, handleChildUpdate }) => {
  return (
    <div>
      <div className="flex items-center mb-2">
        <button onClick={toggleExpand} className="mr-2 focus:outline-none">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <h3 className="text-sm font-medium">
          {getDisplayName(node.name)} {node.attributes?.id ? `(${node.attributes.id})` : ''}
        </h3>
      </div>
      {isExpanded && (
        <div className="pl-4">
          <NodeList 
            nodes={node.children} 
            onUpdate={handleChildUpdate} 
            onAddChild={onAddChild} 
            moveNode={moveChild} 
          />
        </div>
      )}
    </div>
  );
};

const ValueNode: React.FC<{ node: XmlElement; onValueChange: (newValue: string) => void }> = ({ node, onValueChange }) => {
  return (
    <div className="flex items-center mb-4">
      <label className="w-1/4 text-sm font-medium">
        {getDisplayName(node.name)}
      </label>
      <input
        className="input input-bordered w-full max-w-xs"
        value={node.value || ''}
        onChange={(e) => onValueChange(e.target.value)}
      />
    </div>
  );
};

const NodeList: React.FC<{ 
  nodes: XmlElement[]; 
  onUpdate: (updatedNode: XmlElement, index: number) => void; 
  onAddChild: (parentNode: XmlElement, newNodeType: string) => void; 
  moveNode: (dragIndex: number, hoverIndex: number) => void 
}> = ({ nodes, onUpdate, onAddChild, moveNode }) => {

  return (
    <div>
      {nodes.map((child, index) => (
        <DraggableNode
          key={`${gernetKey(child)}-${index}`}
          node={child}
          index={index}
          moveNode={moveNode}
          onUpdate={(updatedNode) => onUpdate(updatedNode, index)}
          onAddChild={onAddChild}
        />
      ))}
    </div>
  );
};

const XmlTree: React.FC<{ data: XmlElement; onUpdate: (updatedData: XmlElement) => void }> = ({ data, onUpdate }) => {
  const handleAddChild = (parentNode: XmlElement, newNodeType: string) => {
    const newNode: XmlElement = {
      name: newNodeType,
      attributes: {},
      value: null,
      children: [],
    };

    const updatedParentNode = {
      ...parentNode,
      children: [...parentNode.children, newNode],
    };

    onUpdate(updatedParentNode);
  };

  const moveNode = (dragIndex: number, hoverIndex: number) => {
    console.log("move Node",dragIndex, hoverIndex);
    const updatedChildren = Array.from(data.children);  // 确保新的数组引用
    const [reorderedItem] = updatedChildren.splice(dragIndex, 1);
    updatedChildren.splice(hoverIndex, 0, reorderedItem);
    
    const updatedData = { ...data, children: updatedChildren };
    onUpdate(updatedData);  // 触发更新
  };
  

  return (
    <DndProvider backend={HTML5Backend}>
      <div>
        <NodeList
          nodes={[data]}
          onUpdate={(updatedNode) => onUpdate(updatedNode)}
          onAddChild={handleAddChild}
          moveNode={moveNode}
        />
      </div>
    </DndProvider>
  );
};

export default XmlTree;

