'use client';

import { useState } from 'react';
import { X, UserPlus, KeyRound, Mail, Phone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authApiUrl } from '@/lib/api-client';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalMode = 'login' | 'signup' | 'findPassword';

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login } = useAuth();
  const [mode, setMode] = useState<ModalMode>('login');
  const [error, setError] = useState('');
  
  // 로그인 폼 상태
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // 회원가입 폼 상태
  const [signupEmployeeNumber, setSignupEmployeeNumber] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  
  // 비밀번호 찾기 폼 상태
  const [findPasswordEmployeeNumber, setFindPasswordEmployeeNumber] = useState('');
  const [findMethod, setFindMethod] = useState<'email' | 'phone'>('email');
  const [findValue, setFindValue] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = await login(employeeNumber, loginPassword);
    if (result.success) {
      onClose();
      setEmployeeNumber('');
      setLoginPassword('');
    } else {
      setError(result.error || '사원번호 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (signupPassword !== signupPasswordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (signupPassword.length < 4) {
      setError('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    setIsSigningUp(true);

    if (!signupEmployeeNumber.trim()) {
      setError('사원번호를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(authApiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          employeeNumber: signupEmployeeNumber.trim(),
          password: signupPassword
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 회원가입 성공 - 자동 로그인
        const loginResult = await login(data.employeeNumber, signupPassword);
        if (loginResult.success) {
          onClose();
          setSignupEmployeeNumber('');
          setSignupPassword('');
          setSignupPasswordConfirm('');
        } else {
          setError('회원가입은 완료되었지만 자동 로그인에 실패했습니다. 로그인 페이지에서 로그인해주세요.');
        }
      } else {
        setError(data.error || '회원가입에 실패했습니다.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setError('회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleFindPassword = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`비밀번호 찾기: 사원번호 - ${findPasswordEmployeeNumber}, ${findMethod === 'email' ? '이메일' : '전화번호'} - ${findValue}`);
    // 실제 비밀번호 찾기 로직 구현
  };

  const handleClose = () => {
    setMode('login');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div 
        className="relative w-full max-w-md bg-white rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="닫기"
        >
          <X className="h-5 w-5 text-slate-600" />
        </button>

        <div className="p-6">
          {/* 헤더 */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === 'login' && '로그인'}
              {mode === 'signup' && '회원가입'}
              {mode === 'findPassword' && '비밀번호 찾기'}
            </h2>
          </div>

          {/* 로그인 폼 */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  사원번호
                </label>
                <input
                  type="text"
                  value={employeeNumber}
                  onChange={(e) => setEmployeeNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder="사원번호를 입력하세요"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                로그인
              </button>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-900 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  회원가입
                </button>
                <button
                  type="button"
                  onClick={() => setMode('findPassword')}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-900 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="h-4 w-4" />
                  비밀번호 찾기
                </button>
              </div>
            </form>
          )}

          {/* 회원가입 폼 */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  사원번호
                </label>
                <input
                  type="text"
                  value={signupEmployeeNumber}
                  onChange={(e) => setSignupEmployeeNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder="사원번호를 입력하세요"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  이름은 기본값 "사용자"로 설정되며, 설정 페이지에서 변경할 수 있습니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder="비밀번호를 입력하세요 (최소 4자)"
                  required
                  minLength={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  value={signupPasswordConfirm}
                  onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                  minLength={4}
                />
              </div>
              <button
                type="submit"
                disabled={isSigningUp}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {isSigningUp ? '회원가입 중...' : '회원가입'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSignupEmployeeNumber('');
                  setSignupPassword('');
                  setSignupPasswordConfirm('');
                }}
                className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-900 rounded-lg font-medium transition-colors"
              >
                로그인으로 돌아가기
              </button>
            </form>
          )}

          {/* 비밀번호 찾기 폼 */}
          {mode === 'findPassword' && (
            <form onSubmit={handleFindPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  사원번호
                </label>
                <input
                  type="text"
                  value={findPasswordEmployeeNumber}
                  onChange={(e) => setFindPasswordEmployeeNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder="사원번호를 입력하세요"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  찾기 방법 선택
                </label>
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setFindMethod('email')}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      findMethod === 'email'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    <Mail className="h-4 w-4" />
                    이메일
                  </button>
                  <button
                    type="button"
                    onClick={() => setFindMethod('phone')}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      findMethod === 'phone'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    <Phone className="h-4 w-4" />
                    전화번호
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  {findMethod === 'email' ? '이메일' : '전화번호'}
                </label>
                <input
                  type={findMethod === 'email' ? 'email' : 'tel'}
                  value={findValue}
                  onChange={(e) => setFindValue(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder={findMethod === 'email' ? '이메일을 입력하세요' : '전화번호를 입력하세요'}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                찾기
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-900 rounded-lg font-medium transition-colors"
              >
                로그인으로 돌아가기
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
