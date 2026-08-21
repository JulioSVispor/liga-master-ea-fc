export function Card({ children, className = "", ...props }) {
  return (
    <div className={`bg-[#060913] border border-gray-800/60 rounded-xl overflow-hidden ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...props }) {
  return (
    <div className={`px-6 py-5 border-b border-gray-800/60 flex items-center justify-between ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "", ...props }) {
  return (
    <h3 className={`text-lg font-semibold text-gray-100 ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className = "", ...props }) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "", ...props }) {
  return (
    <div className={`px-6 py-4 bg-[#03050a] border-t border-gray-800/60 flex items-center ${className}`} {...props}>
      {children}
    </div>
  );
}
