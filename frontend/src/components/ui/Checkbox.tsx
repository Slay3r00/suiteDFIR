interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}

export default function Checkbox({ checked, onChange, disabled = false, label }: CheckboxProps) {
  return (
    <label className="flex items-center space-x-3 p-2 rounded hover:bg-[#30444f] cursor-pointer transition-colors">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="w-4 h-4 rounded border border-white focus:ring-2 focus:ring-gray-600 appearance-none"
          style={{borderWidth: '0.5px', backgroundColor: checked ? '#30444f' : 'transparent'}}
        />
        {checked && (
          <svg className="absolute w-3 h-3 text-white pointer-events-none" style={{top: '3.5px', left: '2px'}} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      {label && <span className="text-sm flex-1 text-white">{label}</span>}
    </label>
  );
}