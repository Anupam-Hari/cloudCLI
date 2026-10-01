type CodeAssistLogoProps = {
  className?: string;
};

const CodeAssistLogo = ({ className = 'w-5 h-5' }: CodeAssistLogoProps) => (
  <div className={`${className} relative overflow-hidden rounded-full`}>
    {/* Blue background */}
    <div className="absolute inset-0 bg-red-600" />

    {/* White logo */}
    <div
      className="absolute inset-0 scale-[1.0] bg-white"
      style={{
        maskImage: 'url(/logo_new.svg)',
        WebkitMaskImage: 'url(/logo_new.svg)',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
      }}
    />
  </div>
);

export default CodeAssistLogo;