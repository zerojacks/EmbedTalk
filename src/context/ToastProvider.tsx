import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AlertInfoIcon, AlertSuccessIcon, AlertWarningIcon, AlertErrorIcon} from '../components/Icons';

type ToastType = 'success' | 'error' | 'info' | 'warning';
type ToastXPosition = 'start' | 'center' | 'end';
type ToastYPosition = 'top' | 'middle' | 'bottom';

interface ToastProps {
    message: string;
    type: ToastType;
    xPosition: ToastXPosition;
    yPosition: ToastYPosition;
    duration: number;
    style?: React.CSSProperties;
}

interface ToastContextType {
    addToast: (toast: ToastProps) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
export const ToastIcon: React.FC<{ type: 'success' | 'error' | 'info' | 'warning' }> = ({ type }) => {
    switch (type) {
        case 'success':
            return <AlertSuccessIcon className="h-6 w-6" />;
        case 'error':
            return <AlertErrorIcon className="h-6 w-6" />;
        case 'info':
            return <AlertInfoIcon className="h-6 w-6" />;
        case 'warning':
            return <AlertWarningIcon className="h-6 w-6" />;
    }
};
const Toast: React.FC<ToastProps & { onClose: () => void; index: number; previousHeights: number[] }> = React.memo(
    ({ message, type, xPosition, yPosition, onClose, index, previousHeights }) => {
        const getPositionClasses = () => `toast-${xPosition} toast-${yPosition}`;
        const getTypeClasses = () => `alert-${type}`;
        
        const toastRef = useRef<HTMLDivElement>(null);
        
        const totalHeightBefore = previousHeights.slice(0, index).reduce((acc, height) => acc + height, 0);

        const getStyleCss = () => {
            return yPosition === 'bottom' ? { marginBottom: `${totalHeightBefore}px` } : { marginTop: `${totalHeightBefore}px` } ;
        };

        useEffect(() => {
            if (toastRef.current) {
                const height = toastRef.current.offsetHeight;
                // Update the previous heights array in the parent component
                previousHeights[index] = height; 
            }
        }, [index]);

        return (
            <div 
                ref={toastRef} 
                className={`toast ${getPositionClasses()}`} 
                style={getStyleCss()} // Directly pass the style object
            >
                <div className={`alert ${getTypeClasses()}`}>
                    <ToastIcon type={type} />
                    <span className="block break-words max-w-xs whitespace-normal">{message}</span>
                    <button onClick={onClose} className="ml-4 text-white">&times;</button>
                </div>
            </div>
        );
    }
);

let toastIdCounter = 0; 
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<(ToastProps & { id: number })[]>([]);
    const addToastRef = useRef<((toast: ToastProps) => void) | null>(null);
    const previousHeights = useRef<number[]>(Array(10).fill(0));

    const addToast = useCallback((toast: ToastProps) => {
        const id = Date.now() + toastIdCounter++;;
        setToasts(prevToasts => [...prevToasts, { ...toast, id }]);
        setTimeout(() => {
            setToasts(prevToasts => prevToasts.filter(t => t.id !== id));
        }, toast.duration);
    }, []);

    useEffect(() => {
        addToastRef.current = addToast;
        setGlobalToast(addToast);
    }, [addToast]);

    // Group toasts by position
    const groupedToasts = toasts.reduce((acc, toast) => {
        const key = `${toast.xPosition}-${toast.yPosition}`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(toast);
        return acc;
    }, {} as { [key: string]: (ToastProps & { id: number })[] });
    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {ReactDOM.createPortal(
                <div className="toast-container flex flex-col break-words max-w-xs whitespace-normal">
                    {Object.entries(groupedToasts).map(([position, toasts]) => (
                        <div className={`toast-group`} key={position}>
                            {toasts
                                .slice() // Create a copy of the array
                                .sort((a, b) => {
                                    // Adjust the sorting based on your requirements
                                    return position === 'end-bottom' ? 1 : -1; // Reverse for non-bottom positions
                                    // return 1;
                                })
                                .map((toast, index) => (
                                    <Toast
                                        key={toast.id} // Unique key for each toast
                                        {...toast}
                                        index={index}
                                        previousHeights={previousHeights.current}
                                        onClose={() => setToasts(prevToasts => prevToasts.filter(t => t.id !== toast.id))}
                                    />
                                ))}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );    
};

// Global toast function
let globalAddToast: ((toast: ToastProps) => void) | null = null;

export const setGlobalToast = (addToast: (toast: ToastProps) => void) => {
    globalAddToast = addToast;
};

const createToast = (type: ToastType) => (
    message: string,
    xPosition: ToastXPosition = 'end',
    yPosition: ToastYPosition = 'bottom',
    duration: number = 3000
) => {
    if (globalAddToast) {
        globalAddToast({ message, type, xPosition, yPosition, duration });
    } else {
        console.error('Toast is not initialized. Use ToastProvider in your app.');
    }
};

export const toast = {
    success: createToast('success'),
    error: createToast('error'),
    info: createToast('info'),
    warning: createToast('warning'),
};

// 新增：初始化函数
let isInitialized = false;
const toastQueue: (() => void)[] = [];

export const initializeToast = () => {
    isInitialized = true;
    while (toastQueue.length > 0) {
        const queuedToast = toastQueue.shift();
        queuedToast?.();
    }
};

// 修改 toast 对象
Object.keys(toast).forEach(key => {
    const originalMethod = toast[key as keyof typeof toast];
    toast[key as keyof typeof toast] = (...args: Parameters<typeof originalMethod>) => {
        if (isInitialized) {
            originalMethod(...args);
        } else {
            toastQueue.push(() => originalMethod(...args));
        }
    };
});