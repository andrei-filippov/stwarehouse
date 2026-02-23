import { useState, useEffect } from 'react';

interface StLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
}

export function StLogo({ size = 'md', animate = true }: StLogoProps) {
  const [rotation, setRotation] = useState(0);
  const [folded, setFolded] = useState(false);

  useEffect(() => {
    if (!animate) return;
    
    const interval = setInterval(() => {
      setRotation(prev => (prev + 90) % 360);
      setFolded(prev => !prev);
    }, 2000);

    return () => clearInterval(interval);
  }, [animate]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  };

  return (
    <div 
      className={`${sizeClasses[size]} relative flex items-center justify-center font-bold select-none`}
      style={{ perspective: '200px' }}
    >
      {/* Фон */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg" />
      
      {/* Буква S */}
      <span 
        className="relative z-10 text-white font-black transition-transform duration-700 ease-in-out"
        style={{
          transform: `rotateY(${folded ? 180 : 0}deg) rotateZ(${animate ? rotation : 0}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        S
      </span>
      
      {/* Буква T */}
      <span 
        className="relative z-10 text-white font-black transition-transform duration-700 ease-in-out -ml-0.5"
        style={{
          transform: `rotateY(${folded ? -180 : 0}deg) rotateZ(${animate ? -rotation : 0}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        T
      </span>
      
      {/* Блик */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-xl pointer-events-none" />
    </div>
  );
}

// Вариант с раздельной анимацией
export function StLogoSplit({ size = 'md', animate = true }: StLogoProps) {
  const [sRotation, setSRotation] = useState(0);
  const [tRotation, setTRotation] = useState(0);

  useEffect(() => {
    if (!animate) return;
    
    const interval = setInterval(() => {
      setSRotation(prev => prev + 360);
      setTimeout(() => setTRotation(prev => prev + 360), 200);
    }, 2500);

    return () => clearInterval(interval);
  }, [animate]);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const fontSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-3xl',
  };

  return (
    <div className={`${sizeClasses[size]} relative flex items-center justify-center`}>
      {/* Фон */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg" />
      
      <div className={`relative flex items-center font-black ${fontSizes[size]}`}>
        {/* Буква S */}
        <span 
          className="text-white transition-transform duration-1000 ease-out inline-block"
          style={{
            transform: `rotate(${sRotation}deg)`,
          }}
        >
          S
        </span>
        
        {/* Буква T */}
        <span 
          className="text-white transition-transform duration-1000 ease-out inline-block -ml-0.5"
          style={{
            transform: `rotate(${tRotation}deg)`,
          }}
        >
          T
        </span>
      </div>
      
      {/* Блик */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-xl pointer-events-none" />
    </div>
  );
}

// Вариант с "переворотом" как карточки
export function StLogoFlip({ size = 'md' }: StLogoProps) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFlipped(prev => !prev);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  };

  return (
    <div 
      className={`${sizeClasses[size]} relative cursor-pointer`}
      style={{ perspective: '400px' }}
    >
      <div 
        className="w-full h-full relative transition-transform duration-700"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(360deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Передняя сторона */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg flex items-center justify-center font-black text-white"
          style={{ backfaceVisibility: 'hidden' }}
        >
          ST
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-xl" />
        </div>
        
        {/* Задняя сторона */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-indigo-700 to-blue-600 rounded-xl shadow-lg flex items-center justify-center font-black text-white"
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="text-xs font-normal opacity-80">Склад<br/>Техники</div>
        </div>
      </div>
    </div>
  );
}

// Вариант с пульсацией
export function StLogoPulse({ size = 'md', animate = true }: StLogoProps) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (!animate) return;
    
    const interval = setInterval(() => {
      setPulse(prev => (prev + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, [animate]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  };

  const getLetterStyle = (letterPulse: number) => {
    const scales = [1, 1.1, 1.2, 1.1];
    const rotations = [0, 5, 0, -5];
    return {
      transform: `scale(${scales[letterPulse]}) rotate(${rotations[letterPulse]}deg)`,
    };
  };

  return (
    <div className={`${sizeClasses[size]} relative flex items-center justify-center`}>
      {/* Фон с пульсацией */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg transition-all duration-300"
        style={{
          transform: `scale(${1 + pulse * 0.05})`,
        }}
      />
      
      <div className="relative flex items-center font-black text-white">
        <span 
          className="inline-block transition-all duration-300"
          style={getLetterStyle(pulse % 4)}
        >
          S
        </span>
        <span 
          className="inline-block transition-all duration-300 -ml-0.5"
          style={getLetterStyle((pulse + 2) % 4)}
        >
          T
        </span>
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-xl pointer-events-none" />
    </div>
  );
}

// Вариант с "сборкой" букв
export function StLogoBuild({ size = 'md' }: StLogoProps) {
  const [built, setBuilt] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBuilt(true), 100);
    const interval = setInterval(() => {
      setBuilt(prev => !prev);
    }, 3000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  };

  return (
    <div className={`${sizeClasses[size]} relative flex items-center justify-center overflow-hidden rounded-xl`}>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700" />
      
      <div className="relative flex items-center font-black text-white">
        {/* Буква S - падает сверху */}
        <span 
          className="inline-block transition-all duration-700 ease-bounce"
          style={{
            transform: built ? 'translateY(0) rotate(0deg)' : 'translateY(-150%) rotate(-180deg)',
            opacity: built ? 1 : 0,
          }}
        >
          S
        </span>
        
        {/* Буква T - выезжает сбоку */}
        <span 
          className="inline-block transition-all duration-700 ease-bounce delay-150 -ml-0.5"
          style={{
            transform: built ? 'translateX(0) rotate(0deg)' : 'translateX(150%) rotate(180deg)',
            opacity: built ? 1 : 0,
            transitionDelay: '150ms',
          }}
        >
          T
        </span>
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
    </div>
  );
}

// Главный экспорт - выбираем лучший вариант
export function StLogoMain({ size = 'md' }: StLogoProps) {
  return <StLogoBuild size={size} />;
}

export default StLogoMain;
