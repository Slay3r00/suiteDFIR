import { forwardRef } from 'react';
import { ButtonVariant } from '../../app/ileapp/types';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  className?: string;
  style?: React.CSSProperties;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, onClick, disabled = false, variant = 'primary', className = '', style }, ref) => {
  const base = 'px-4 py-2 rounded-lg font-bold transition-all text-sm border';
  const variants = {
    primary: disabled
      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
      : 'bg-black text-white hover:bg-gray-900 active:scale-95',
    secondary: disabled
      ? 'text-white cursor-not-allowed'
      : 'text-white hover:bg-[#3a5464] active:scale-95',
    danger: disabled
      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
      : 'bg-black text-red-600 border border-red-600 hover:border-red-700 active:scale-95',
  };

  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
      style={style || (variant === 'secondary' ? {backgroundColor: '#30444f', color: 'white', borderColor: '#171717', borderWidth: '0.5px'} : {borderColor: '#171717', borderWidth: '0.5px'})}
    >
      {children}
    </button>
  );
}
);

Button.displayName = 'Button';

export default Button;