interface InputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function Input({
  value,
  onChange,
  disabled = false,
  placeholder = '',
  className = '',
  style
}: InputProps) {
  const defaultStyle = {
    backgroundColor: '#171717',
    borderColor: '#f2f2f2',
    borderWidth: '0.5px'
  };

  const defaultClassName = 'px-3 py-2 rounded-lg placeholder-gray-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white text-white border border-gray-800 text-sm';

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={`${defaultClassName} ${className}`}
      style={style || defaultStyle}
    />
  );
}