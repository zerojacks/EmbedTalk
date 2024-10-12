import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import MonacoEditor from './highlighteredit'

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

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
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

const XmlConverter: React.FC<EnhancedXmlEditorProps> = memo(({ initialXml, onXmlElementChange }) => {
    if (!initialXml || !initialXml.name) {
        return null;
    }
    const [xmlText, setXmlText] = useState(convertToXml(initialXml));

    const parseXml = useCallback((xmlString: string): XmlElement | null => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");

        // 检查解析是否成功
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            console.error("Invalid XML: ", xmlDoc.getElementsByTagName('parsererror')[0].textContent);
            return null; // 或者返回一个错误对象，取决于你的需求
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

        return parseElement(xmlDoc.documentElement);
    }, []);

    const onXmlEditorChange = useCallback((xmlString: string) => {
        const xmlElement = parseXml(xmlString);
        if (xmlElement) {
            onXmlElementChange(xmlElement);
        } else {
            console.log("XML parsing failed.");
        }
    }, []);

    return (
        <div className="w-full h-full textarea-bordered rounded border">
            <MonacoEditor
                initialValue={xmlText}
                language="xml"
                onChange={onXmlEditorChange}
            />
        </div>
    );
});

export default XmlConverter;
