import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { TopicFormData } from '../../../../types/channel';

interface SubscriptionDialogProps {
    open: boolean;
    onClose: () => void;
    onSubscribe: (topic: string, qos: number, alias?: string, color?: string) => void;
}

const SubscriptionDialog: React.FC<SubscriptionDialogProps> = ({
    open,
    onClose,
    onSubscribe
}) => {
    const [formData, setFormData] = useState<TopicFormData>({
        topic: '',
        qos: 0,
        alias: '',
        color: '#ED01AF'
    });

    const handleSubmit = () => {
        if (!formData.topic.trim()) return;
        onSubscribe(formData.topic, formData.qos, formData.alias, formData.color);
        // 重置表单
        setFormData({
            topic: '',
            qos: 0,
            alias: '',
            color: '#ED01AF'
        });
        onClose();
    };

    return (
        <dialog className={`modal ${open ? 'modal-open' : ''}`}>
            <div className="modal-box">
                <h3 className="font-bold text-lg mb-4">添加订阅</h3>

                <div className="form-control w-full">
                    <label className="label">
                        <span className="label-text">主题</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.topic}
                        onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                        placeholder="输入主题..."
                        className="input input-bordered w-full"
                    />
                </div>

                <div className="form-control w-full mt-4">
                    <label className="label">
                        <span className="label-text">QoS</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <select
                        value={formData.qos}
                        onChange={(e) => setFormData(prev => ({ ...prev, qos: Number(e.target.value) }))}
                        className="select select-bordered w-full"
                    >
                        <option value={0}>QoS 0 - 最多一次</option>
                        <option value={1}>QoS 1 - 至少一次</option>
                        <option value={2}>QoS 2 - 恰好一次</option>
                    </select>
                </div>

                <div className="form-control w-full mt-4">
                    <label className="label">
                        <span className="label-text">标记颜色</span>
                        <div className="label-text-alt flex items-center gap-1">
                            <input
                                type="color"
                                value={formData.color}
                                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                className="w-6 h-6 rounded cursor-pointer"
                            />
                        </div>
                    </label>
                    <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                        className="input input-bordered w-full"
                    />
                </div>

                <div className="form-control w-full mt-4">
                    <label className="label">
                        <span className="label-text">别名</span>
                        <span className="label-text-alt flex items-center gap-1">
                            <Info className="w-4 h-4" />
                        </span>
                    </label>
                    <input
                        type="text"
                        value={formData.alias}
                        onChange={(e) => setFormData(prev => ({ ...prev, alias: e.target.value }))}
                        placeholder="给主题起个别名..."
                        className="input input-bordered w-full"
                    />
                </div>

                <div className="modal-action">
                    <button
                        className="btn"
                        onClick={onClose}
                    >
                        取消
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={!formData.topic.trim()}
                    >
                        确定
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </dialog>
    );
};

export default SubscriptionDialog; 