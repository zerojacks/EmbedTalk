import React, { useState, useEffect, useCallback, memo } from 'react';
import MonacoEditorArea from './highlighteredit';
import { XmlElement } from '../stores/useItemConfigStore';
import Split from 'react-split';

interface EnhancedXmlEditorProps {
  initialXml: XmlElement;
  onXmlElementChange: (xmlElement: XmlElement) => void;
}

const convertToXml = (element: XmlElement, indent: string = ''): string => {
    if (!element || !element.name) {
      return '';
    }
    
    let xmlString = `${indent}<${element.name}`;

    // Add attributes
    for (const [key, value] of Object.entries(element.attributes)) {
        xmlString += ` ${key}="${value}"`;
    }

    if (element.children.length === 0 && !element.value) {
        return `${xmlString} />`;
    }

    xmlString += '>';

    if (element.value !== null) {
        xmlString += element.value;
    } else {
        xmlString += '\n';
        for (const child of element.children) {
            xmlString += convertToXml(child, `${indent}  `) + '\n';
        }
        xmlString += indent;
    }

    xmlString += `</${element.name}>`;
    return xmlString;
};

async function parseXml(xmlString: string) {
  if (xmlString.trim() === '') {
      return { name: '', attributes: {}, value: null, children: [] }; // 空字符串返回空对象
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  // 检查解析是否成功
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      const errorMessage = xmlDoc.getElementsByTagName('parsererror')[0].textContent || "Unknown error";
      console.error("Invalid XML: ", errorMessage);
      throw new Error(errorMessage); // 直接抛出错误
  }

  const parseElement = (element: Element): XmlElement => {
      const result: XmlElement = {
          name: element.tagName,
          attributes: {},
          value: element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE
              ? element.textContent
              : null,
          children: []
      };

      // 解析属性
      for (const attr of element.attributes) {
          result.attributes[attr.name] = attr.value;
      }

      // 解析子元素
      for (const child of element.children) {
          result.children.push(parseElement(child));
      }

      return result;
  };

  return parseElement(xmlDoc.documentElement); // 直接返回解析后的结果
} 

const XmlConverter: React.FC<EnhancedXmlEditorProps> = memo(({ initialXml, onXmlElementChange }) => {
  const [xmlText, setXmlText] = useState(convertToXml(initialXml));
  const [errorLogs, setErrorLogs] = useState<string>('');

  useEffect(() => {
    setXmlText(convertToXml(initialXml));
  }, [initialXml]);

  const onXmlEditorChange = useCallback(async (xmlString: string): Promise<string | null> => {
    try {
      const xmlElement: XmlElement = await parseXml(xmlString);
      if (xmlElement.name !== '') {
        onXmlElementChange(xmlElement);
      }
      setErrorLogs('');
      return null; // Success returns null
    } catch (error) {
      let errorMessage = "An unknown error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setErrorLogs(errorMessage);
      return errorMessage; // Failure returns error message
    }
  }, [onXmlElementChange]);

  return (
    <div className="w-full h-full relative">
      <Split
        direction="vertical"
        sizes={[100, 0]}
        minSize={[100, 24]}
        gutterSize={2}
        snapOffset={30}
        dragInterval={0}
        className="flex flex-col w-full h-full"
      >
        <div className="w-full h-full overflow-hidden">
          <MonacoEditorArea
            initialValue={xmlText}
            language="xml"
            onEditorChange={onXmlEditorChange}
          />
        </div>
        <div className="w-full bg-neutral overflow-hidden flex flex-col">
          <div 
            className="h-6 bg-base-300 flex justify-between items-center px-2 cursor-pointer"
          >
            <span className="flex items-center">
              问题 {errorLogs && <span className="ml-1 indicator-item indicator-middle badge badge-secondary w-2 h-2 rounded-full p-0"></span>}
            </span>
          </div>
          <div className="flex-grow overflow-auto">
            {errorLogs && (
              <pre className="text-red-600 whitespace-pre-wrap">{errorLogs}</pre>
            )}
          </div>
        </div>
      </Split>
    </div>
  );
});

export default XmlConverter;