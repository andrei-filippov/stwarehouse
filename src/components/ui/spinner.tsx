import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

function Spinner({ className, size = 'md' }: SpinnerProps) {
  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  };

  return (
    <div className={cn(sizes[size], 'relative', className)}>
      {/* Внешнее кольцо вращения */}
      <div className="absolute inset-0 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
      
      {/* Внутренний контейнер с буквами */}
      <div className="absolute inset-1 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center animate-pulse">
        <div className="flex items-center font-black text-white leading-none">
          <span className="animate-[spin_3s_ease-in-out_infinite] inline-block">S</span>
          <span className="animate-[spin_3s_ease-in-out_infinite_reverse] inline-block -ml-0.5">T</span>
        </div>
      </div>
      
      {/* Блик */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent rounded-full pointer-events-none" />
    </div>
  );
}

// Вариант с раздельной анимацией букв
function SpinnerSplit({ className, size = 'md' }: SpinnerProps) {
  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  };

  return (
    <div className={cn(sizes[size], 'relative', className)}>
      {/* Фон */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full animate-pulse" />
      
      {/* Буква S - вращается */}
      <span 
        className="absolute inset-0 flex items-center justify-center font-black text-white leading-none"
        style={{
          animation: 'spin-s 2s ease-in-out infinite',
        }}
      >
        <span className="relative">
          S
          <span 
            className="absolute left-full"
            style={{ animation: 'spin-t 2s ease-in-out infinite 0.5s' }}
          >
            T
          </span>
        </span>
      </span>
      
      {/* Блик */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent rounded-full pointer-events-none" />
      
      <style>{`
        @keyframes spin-s {
          0%, 100% { transform: rotateY(0deg); }
          50% { transform: rotateY(360deg); }
        }
        @keyframes spin-t {
          0%, 100% { transform: rotateY(0deg); }
          50% { transform: rotateY(-360deg); }
        }
      `}</style>
    </div>
  );
}

// Вариант с "складыванием"
function SpinnerFold({ className, size = 'md' }: SpinnerProps) {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const fontSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  return (
    <div 
      className={cn(sizes[size], 'relative', className)}
      style={{ perspective: '100px' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full" />
      
      <div className={cn('absolute inset-0 flex items-center justify-center font-black text-white', fontSizes[size])}>
        <span 
          className="inline-block"
          style={{
            animation: 'fold-s 2s ease-in-out infinite',
          }}
        >
          S
        </span>
        <span 
          className="inline-block -ml-0.5"
          style={{
            animation: 'fold-t 2s ease-in-out infinite',
          }}
        >
          T
        </span>
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent rounded-full pointer-events-none" />
      
      <style>{`
        @keyframes fold-s {
          0%, 100% { 
            transform: rotateY(0deg);
            opacity: 1;
          }
          25% { 
            transform: rotateY(90deg);
            opacity: 0.5;
          }
          50% { 
            transform: rotateY(0deg);
            opacity: 1;
          }
        }
        @keyframes fold-t {
          0%, 100% { 
            transform: rotateY(0deg);
            opacity: 1;
          }
          50% { 
            transform: rotateY(-90deg);
            opacity: 0.5;
          }
          75% { 
            transform: rotateY(0deg);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// Вариант с "пульсацией" и вращением
function SpinnerPulse({ className, size = 'md' }: SpinnerProps) {
  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  };

  return (
    <div className={cn(sizes[size], 'relative', className)}>
      {/* Пульсирующий фон */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full"
        style={{
          animation: 'pulse-scale 1.5s ease-in-out infinite',
        }}
      />
      
      {/* Вращающиеся буквы */}
      <div 
        className="absolute inset-0 flex items-center justify-center font-black text-white"
        style={{
          animation: 'spin-around 2s linear infinite',
        }}
      >
        <span className="relative">
          <span className="absolute -left-2">S</span>
          <span className="absolute -right-2">T</span>
        </span>
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent rounded-full pointer-events-none" />
      
      <style>{`
        @keyframes pulse-scale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes spin-around {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export { Spinner, SpinnerSplit, SpinnerFold, SpinnerPulse };
export default Spinner;
