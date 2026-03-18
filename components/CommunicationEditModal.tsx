'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Communication {
  user: string;
  message: string;
  time: string;
  content: string;
  replies?: Array<{ user: string; message: string; time: string }>;
}

interface CommunicationEditModalProps {
  communication: Communication | null;
  onClose: () => void;
  onSave: (communication: Communication) => void;
  currentUser: string;
}

export default function CommunicationEditModal({ 
  communication, 
  onClose, 
  onSave,
  currentUser 
}: CommunicationEditModalProps) {
  const [message, setMessage] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (communication) {
      setMessage(communication.message);
      setContent(communication.content);
    } else {
      setMessage('');
      setContent('');
    }
  }, [communication]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newCommunication: Communication = {
      user: currentUser,
      message: message.trim(),
      content: content.trim(),
      time: timeString,
      replies: communication?.replies || [],
    };

    onSave(newCommunication);
  };

  return (
    <div className="absolute inset-0 z-[70] bg-white flex flex-col min-h-0">
      <div className="shrink-0 h-14 px-4 border-b border-slate-200 flex items-center justify-between">
        <span className="font-semibold text-slate-900">
          {communication ? '글 수정' : '글 작성'}
        </span>
        <button
          type="button"
          className="rounded-lg p-2 hover:bg-slate-100"
          onClick={onClose}
          aria-label="닫기"
        >
          <X className="h-5 w-5 text-slate-600" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">제목</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
              placeholder="글 제목을 입력하세요"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 resize-y min-h-[8rem]"
              placeholder="글 내용을 입력하세요"
              required
            />
          </div>
        </div>
        <div className="shrink-0 p-4 border-t border-slate-200 bg-white flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-900 rounded-lg font-medium transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            {communication ? '수정' : '작성'}
          </button>
        </div>
      </form>
    </div>
  );
}
