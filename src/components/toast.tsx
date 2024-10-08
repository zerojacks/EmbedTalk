import React, { useState } from 'react';
import { AlertInfoIcon, AlertSuccessIcon, AlertWarningIcon, AlertErrorIcon} from './Icons';
interface Toast {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    xlevel: 'start' | 'center' | 'end';
    ylevel: 'start' | 'center' | 'end';
}

export const ToastIcon: React.FC<{ type: 'success' | 'error' | 'info' | 'warning' }> = ({ type }) => {
    switch (type) {
        case 'success':
            return <AlertSuccessIcon className="h-6 w-6 shrink-0 stroke-current" />;
        case 'error':
            return <AlertErrorIcon className="h-6 w-6 shrink-0 stroke-current" />;
        case 'info':
            return <AlertInfoIcon className="h-6 w-6 shrink-0 stroke-current" />;
        case 'warning':
            return <AlertWarningIcon className="h-6 w-6 shrink-0 stroke-current" />;
    }
};

type ToastArgs = [string, 'start' | 'center' | 'end', 'start' | 'center' | 'end', number];

let setToastFunction: React.Dispatch<React.SetStateAction<Toast[]>>;

const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning', xlevel: 'start' | 'center' | 'end', ylevel: 'start' | 'center' | 'end', duration: number) => {
    if (setToastFunction) {
        const toast: Toast = { message, type, xlevel, ylevel };
        setToastFunction(prev => [...prev, toast]);

        setTimeout(() => {
            setToastFunction(prev => prev.filter(t => t !== toast)); // 移除 Toast
        }, duration);
    }
};

const createToast = (setToasts: React.Dispatch<React.SetStateAction<Toast[]>>) => {
    setToastFunction = setToasts;

    return {
        success: (args: ToastArgs) => showToast(args[0], 'success', args[1], args[2], args[3]),
        error: (args: ToastArgs) => showToast(args[0], 'error', args[1], args[2], args[3]),
        info: (args: ToastArgs) => showToast(args[0], 'info', args[1], args[2], args[3]),
        warning: (args: ToastArgs) => showToast(args[0], 'warning', args[1], args[2], args[3]),
    };
};

export const ToastProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    createToast(setToasts);

    return (
        <>
            {children}
            <div className="toast-container">
                {toasts.map((t, index) => (
                    <div key={index} className={`toast toast-${t.xlevel} toast-${t.ylevel}`}>
                        <div className={`alert alert-${t.type}`}>
                            <AlertSuccessIcon className="h-6 w-6" />
                            <span>{t.message}</span>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

export const toast = createToast;
