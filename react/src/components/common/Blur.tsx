type BlurProps = {
  direction?: 't-b' | 'l-r' | 'r-l' | 'b-t'
  className?: string
}

const Blur: React.FC<BlurProps> = ({ className, direction = 't-b' }) => {
  const deg =
    direction === 't-b'
      ? 0
      : direction === 'l-r'
        ? -90
        : direction === 'r-l'
          ? 90
          : 180

  return (
    <div className={`grid -z-1 ${className}`}>
      <span
        style={{
          gridArea: '1 / 1',
          WebkitBackdropFilter: 'blur(1px)',
          backdropFilter: 'blur(1px)',
          WebkitMask: `linear-gradient(${deg}deg, transparent, #fff 8%)`,
          mask: `linear-gradient(${deg}deg, transparent, #fff 8%)`,
        }}
      />
      <span
        style={{
          gridArea: '1 / 1',
          WebkitBackdropFilter: 'blur(4px)',
          backdropFilter: 'blur(4px)',
          WebkitMask: `linear-gradient(${deg}deg, transparent 8%, #fff 16%)`,
          mask: `linear-gradient(${deg}deg, transparent 8%, #fff 16%)`,
        }}
      />
      <span
        style={{
          gridArea: '1 / 1',
          WebkitBackdropFilter: 'blur(8px)',
          backdropFilter: 'blur(8px)',
          WebkitMask: `linear-gradient(${deg}deg, transparent 16%, #fff 24%)`,
          mask: `linear-gradient(${deg}deg, transparent 16%, #fff 24%)`,
        }}
      />
      <span
        style={{
          gridArea: '1 / 1',
          WebkitBackdropFilter: 'blur(16px)',
          backdropFilter: 'blur(16px)',
          WebkitMask: `linear-gradient(${deg}deg, transparent 24%, #fff 36%)`,
          mask: `linear-gradient(${deg}deg, transparent 24%, #fff 36%)`,
        }}
      />
      <span
        style={{
          gridArea: '1 / 1',
          WebkitBackdropFilter: 'blur(24px)',
          backdropFilter: 'blur(24px)',
          WebkitMask: `linear-gradient(${deg}deg, transparent 36%, #fff 48%)`,
          mask: `linear-gradient(${deg}deg, transparent 36%, #fff 48%)`,
        }}
      />
      <span
        style={{
          gridArea: '1 / 1',
          WebkitBackdropFilter: 'blur(32px)',
          backdropFilter: 'blur(32px)',
          WebkitMask: `linear-gradient(${deg}deg, transparent 48%, #fff 64%)`,
          mask: `linear-gradient(${deg}deg, transparent 48%, #fff 64%)`,
        }}
      />
    </div>
  )
}

export default Blur
