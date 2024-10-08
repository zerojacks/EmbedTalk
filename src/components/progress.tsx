import React from 'react';

const Progress = ({ type = "success", value = 0, max = 100, xlevel = "end", ylevel = "end" }) => {
    const toastClass = `toast toast-${xlevel} toast-${ylevel}`;
    let progressClass = `progress progress-${type} w-56`;
    let withValue = true;

    if (type === "") {
        progressClass = `progress w-56`;
        withValue = false;
    }

    return (
        <div className={toastClass}>
            {withValue ? (
                <progress className={progressClass} value={value} max={max}></progress>
            ) : (
                <progress className={progressClass}></progress>
            )}
        </div>
    );
};

export default Progress;