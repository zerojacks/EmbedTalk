import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import MonacoEditorArea from './highlighteredit';
import { ChevronRight, ChevronDown } from './Icons';

export interface XmlElement {
  name: string;
  attributes: { [key: string]: string };
  value: string | null;
  children: XmlElement[];
}

interface EnhancedXmlEditorProps {
  initialXml: XmlElement;
  onXmlElementChange: (xmlElement: XmlElement) => void;
}

const convertToXml = (element: XmlElement, indent: string = ''): string => {
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


const parseXml = useCallback(async (xmlString: string): Promise<XmlElement> => {
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
}, []);

const XmlConverter: React.FC<EnhancedXmlEditorProps> = memo(({ initialXml, onXmlElementChange }) => {
    const [xmlText, setXmlText] = useState(convertToXml(initialXml));
    const [errorLogs, setErrorLogs] = useState<string>('');
    const [errorPanelHeight, setErrorPanelHeight] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const errorPanelRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
      setXmlText(convertToXml(initialXml));
    }, [initialXml]);
  
    const onXmlEditorChange = async (xmlString: string) => {
      try {
        const xmlElement: XmlElement = await parseXml(xmlString);
        onXmlElementChange(xmlElement);
        setErrorLogs('');
      } catch (error) {
        if (error instanceof Error) {
          setErrorLogs(error.message);
        } else {
          setErrorLogs("An unknown error occurred.");
        }
      }
    };
  
    const toggleErrorPanel = () => {
      setErrorPanelHeight(prevHeight => prevHeight === 0 ? 200 : 0);
    };
  
    const startResize = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setStartY(e.clientY);
    };
  
    const stopResize = () => {
      setIsDragging(false);
    };
  
    const resize = useCallback((e: MouseEvent) => {
      if (isDragging && errorPanelRef.current && containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const deltaY = startY - e.clientY;
        const newHeight = Math.min(Math.max(0, errorPanelHeight + deltaY), containerHeight - 24);
        setErrorPanelHeight(newHeight);
        setStartY(e.clientY);
      }
    }, [isDragging, startY, errorPanelHeight]);
  
    useEffect(() => {
      if (isDragging) {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResize);
      }
      return () => {
        window.removeEventListener('mousemove', resize);
        window.removeEventListener('mouseup', stopResize);
      };
    }, [isDragging, resize]);
  
    return (
      <div ref={containerRef} className="w-full h-full relative">
        <div className="w-full h-full">
          <MonacoEditorArea
            initialValue={xmlText}
            language="xml"
            onEditorChange={onXmlEditorChange}
          />
        </div>
        <div 
          ref={errorPanelRef}
          className="absolute bottom-0 left-0 right-0 bg-gray-100 transition-all duration-300 ease-in-out overflow-hidden"
          style={{ 
            height: `${errorPanelHeight}px`,
            maxHeight: 'calc(100% - 24px)'
          }}
        >
          <div 
            className="absolute top-0 left-0 right-0 h-6 bg-gray-200 flex justify-between items-center px-2 cursor-ns-resize"
            onMouseDown={startResize}
          >
            <span className="flex items-center cursor-pointer" onClick={toggleErrorPanel}>
              {errorPanelHeight > 0 ? <ChevronDown className="w-5 h-5 mr-1" /> : <ChevronRight className="w-5 h-5 mr-1" />}
              Error Logs
            </span>
          </div>
          <div className="p-2 overflow-auto" style={{ height: 'calc(100% - 24px)', marginTop: '24px' }}>
            <pre className="text-red-600 whitespace-pre-wrap">{errorLogs}</pre>
          </div>
        </div>
      </div>
    );
  });

  export default XmlConverter;