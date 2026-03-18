'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Notice {
  id?: number;
  title: string;
  date: string;
  important: boolean;
  content: string;
  author?: string;
}

interface NoticeEditModalProps {
  notice: Notice | null;
  onClose: () => void;
  onSave: (notice: Notice) => void;
}

export default function NoticeEditModal({ notice, onClose, onSave }: NoticeEditModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [important, setImportant] = useState(false);

  useEffect(() => {
    if (notice) {
      setTitle(notice.title);
      setContent(notice.content);
      setImportant(notice.important);
    } else {
      setTitle('');
      setContent('');
      setImportant(false);
    }
  }, [notice]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    const newNotice: Notice = {
      ...(notice?.id != null && { id: notice.id }),
      title: title.trim(),
      content: content.trim(),
      date: notice?.date || new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(/\./g, '.').replace(/\s/g, '').replace(/\.$/, ''),
      important,
      author: notice?.author || '시스템 관리팀',
    };

    onSave(newNotice);
  };

  return (
    <div className="absolute inset-0 z-[70] bg-white flex flex-col min-h-0">
      <div className="shrink-0 h-14 px-4 border-b border-slate-200 flex items-center justify-between">
        <span className="font-semibold text-slate-900">
          {notice ? '공지사항 수정' : '공지사항 작성'}
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
            <label className="block text-sm font-medium text-slate-900 mb-2">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
              placeholder="공지사항 제목을 입력하세요"
              required
            />
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={important}
                onChange={(e) => setImportant(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-900">중요 공지사항</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              내용
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 resize-y min-h-[8rem]"
              placeholder="공지사항 내용을 입력하세요"
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
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {notice ? '수정' : '작성'}
          </button>
        </div>
      </form>
    </div>
  );
}
