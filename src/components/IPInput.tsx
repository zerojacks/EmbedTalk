import React from "react";
type BlockKeys = "block-1" | "block-2" | "block-3" | "block-4";

function IpInput() {
    const [blocks, setBlocks] = React.useState<Record<BlockKeys, string>>({
        "block-1": "",
        "block-2": "",
        "block-3": "",
        "block-4": "",
    });
    const [ipInput, setIpInput] = React.useState("");
    const [focusedInput, setFocusedInput] = React.useState(1); // Restrict to valid inputs

    React.useEffect(() => {
        const inputElement = document.getElementById(`block-${focusedInput}`);
        if (inputElement) {
            inputElement.focus();
        }
    }, [focusedInput]);
    


    React.useEffect(() => {
        const blockKey = `block-${focusedInput}` as BlockKeys; // Type assertion
        const blockArr: string[] = [];
    
        if (blocks[blockKey]?.length === 3 && focusedInput < 4) {
            setFocusedInput(focusedInput + 1);
        }
    
        (Object.keys(blocks) as BlockKeys[]).forEach((key) => {
            blockArr.push(blocks[key]);
        });
    
        if (blockArr.length > 0) {
            setIpInput(blockArr.join("."));
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
        setIpInput("");
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
                    className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    onClick={handleClear}
                >
                    Clear
                </button>
            </header>
        </div>
    );
}

export default IpInput;
