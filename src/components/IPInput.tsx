import React from "react";
type BlockKeys = "block-1" | "block-2" | "block-3" | "block-4";

interface IpInputProps {
  value: string;
  onChange: (value: string) => void;
}

function IpInput({ value, onChange }: IpInputProps) {
    const [blocks, setBlocks] = React.useState<Record<BlockKeys, string>>({
        "block-1": "",
        "block-2": "",
        "block-3": "",
        "block-4": "",
    });
    const [focusedInput, setFocusedInput] = React.useState(1); // Restrict to valid inputs
    const [internalValue, setInternalValue] = React.useState(value);
    const isInitialMount = React.useRef(true);

    // 初始化时，根据传入的 value 设置 blocks
    React.useEffect(() => {
        if (value && value !== internalValue) {
            const parts = value.split('.');
            if (parts.length === 4) {
                setBlocks({
                    "block-1": parts[0],
                    "block-2": parts[1],
                    "block-3": parts[2],
                    "block-4": parts[3],
                });
                setInternalValue(value);
            }
        }
    }, [value, internalValue]);

    React.useEffect(() => {
        const inputElement = document.getElementById(`block-${focusedInput}`);
        if (inputElement) {
            inputElement.focus();
        }
    }, [focusedInput]);
    
    React.useEffect(() => {
        // 跳过首次渲染
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        const blockKey = `block-${focusedInput}` as BlockKeys; // Type assertion
        const blockArr: string[] = [];
    
        if (blocks[blockKey]?.length === 3 && focusedInput < 4) {
            setFocusedInput(focusedInput + 1);
        }
    
        (Object.keys(blocks) as BlockKeys[]).forEach((key) => {
            blockArr.push(blocks[key]);
        });
    
        if (blockArr.length > 0) {
            const ipString = blockArr.join(".");
            // 只有在所有块都有值且 IP 格式正确时才调用 onChange
            if (blockArr.every(block => block !== "") && isValidIP(ipString) && ipString !== internalValue) {
                setInternalValue(ipString);
                onChange(ipString);
            }
        }
    }, [blocks, focusedInput]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (
            parseInt(event.target.value.split("")[0]) === 0 &&
            event.target.value.length > 1
        ) {
            return;
        } else if (
            (Number(event.target.value) >= 0 && Number(event.target.value) < 256) ||
            event.target.value === ""
        ) {
            setBlocks({ ...blocks, [event.target.name]: event.target.value });
        }
    };

    const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
        const target = event.target as HTMLInputElement; // Assert type
        setFocusedInput(parseInt(target.name.split("-")[1]));
    };

    const handleClear = () => {
        setBlocks({
            "block-1": "",
            "block-2": "",
            "block-3": "",
            "block-4": "",
        });
        setInternalValue("");
        onChange("");
        setFocusedInput(1);
    };

    const handleKeyEvents = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            if (focusedInput < 4) {
                setFocusedInput(focusedInput + 1);
            } else {
                setFocusedInput(1);
            }
        }
    };    

    const isValidIP = (ip: string) => {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        for (const part of parts) {
            if (isNaN(Number(part)) || Number(part) < 0 || Number(part) > 255) return false;
        }
        return true;
    };

    return (
        <div className="flex flex-col items-center">
            <header className="w-full">
                <div className="flex items-center space-x-1">
                    {Array.from({ length: 4 }, (_, index) => (
                        <React.Fragment key={`block-${index + 1}`}>
                            <input
                                onKeyDown={handleKeyEvents}
                                maxLength={3}
                                type="number"
                                className="w-16 h-10 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                name={`block-${index + 1}`}
                                id={`block-${index + 1}`}
                                onChange={handleChange}
                                onClick={handleClick}
                                value={blocks[`block-${index + 1}` as BlockKeys]}
                            />
                            {index < 3 && <span className="text-2xl">.</span>}
                        </React.Fragment>
                    ))}
                </div>
                <button
                    className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    onClick={handleClear}
                >
                    清除
                </button>
            </header>
        </div>
    );
}

export default IpInput;
