import React, { useState, useEffect, useCallback, useRef } from 'react';
import MonacoEditor from './MonacoEditor';
import { XmlElement } from '../stores/useItemConfigStore';
import Split from 'react-split';
import { useDebounce } from '../hooks/useDebounce';
import { useSelector } from 'react-redux';
import { selectEffectiveTheme } from '../store/slices/themeSlice';
import { Theme } from '@monaco-editor/react';
import { useSettingsContext } from '../context/SettingsProvider';

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
    return { name: '', attributes: {}, value: null, children: [] };
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    const errorMessage = xmlDoc.getElementsByTagName('parsererror')[0].textContent || "Unknown error";
    throw new Error(errorMessage);
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

    for (const attr of element.attributes) {
      result.attributes[attr.name] = attr.value;
    }

    for (const child of element.children) {
      result.children.push(parseElement(child));
    }

    return result;
  };

  return parseElement(xmlDoc.documentElement);
}

const XmlConverter: React.FC<EnhancedXmlEditorProps> = ({ initialXml, onXmlElementChange }) => {
  const [xmlText, setXmlText] = useState(convertToXml(initialXml));
  const [errorLogs, setErrorLogs] = useState<string>('');
  const lastValidXmlRef = useRef<string>(xmlText);
  const isParsingRef = useRef(false);
  const { effectiveTheme } = useSettingsContext();
  const [edtheme, setEdtheme] = useState<Theme>(effectiveTheme === 'dark' ? 'vs-dark' : 'light');

  useEffect(() => {
    const newXmlText = convertToXml(initialXml);
    if (newXmlText !== xmlText) {
      setXmlText(newXmlText);
      lastValidXmlRef.current = newXmlText;
    }
  }, [initialXml]);

  useEffect(() => {
    console.log("xml theme", effectiveTheme)
    setEdtheme(effectiveTheme === 'dark' ? 'vs-dark' : 'light')
  }, [effectiveTheme])

  const handleEditorChange = useCallback((newValue: string) => {
    if (isParsingRef.current) return;
    setXmlText(newValue);
  }, []);

  const handleSave = useCallback(async (content: string) => {
    if (isParsingRef.current) return;
    
    try {
      isParsingRef.current = true;
      const xmlElement = await parseXml(content);
      if (xmlElement.name !== '') {
        lastValidXmlRef.current = content;
        onXmlElementChange(xmlElement);
        setErrorLogs('');
      }
    } catch (error) {
      let errorMessage = "An unknown error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setErrorLogs(errorMessage);
    } finally {
      isParsingRef.current = false;
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
          <MonacoEditor
            theme={edtheme}
            value={xmlText}
            language="xml"
            onChange={handleEditorChange}
            onSave={handleSave}
          />
        </div>
        <div className="w-full bg-neutral overflow-hidden flex flex-col">
          <div className="h-6 bg-base-300 flex justify-between items-center px-2 cursor-pointer">
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
};

export default React.memo(XmlConverter);