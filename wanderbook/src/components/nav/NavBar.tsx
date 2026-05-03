'use client';

interface NavItem { icon: string; label: string; }

const NAV_ITEMS: NavItem[] = [
  { icon: '📔', label: 'Book' },
  { icon: '🌍', label: 'Explore' },
  { icon: '✈️', label: 'Trips' },
];

interface NavBarProps {
  isVisible: boolean;
}

export default function NavBar({ isVisible }: NavBarProps) {
  return (
    <nav className={`nav-bar${isVisible ? ' visible' : ''}`}>
      {NAV_ITEMS.map((item, i) => (
        <div
          key={item.label}
          style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '4px',
            opacity: i === 0 ? 1 : 0.28, cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
        >
          <span style={{ fontSize: '19px', lineHeight: 1 }}>{item.icon}</span>
          <span style={{
            fontSize: '8.5px', letterSpacing: '0.3px',
            color: i === 0 ? '#1a1a1a' : '#555',
            fontWeight: i === 0 ? 600 : 400,
          }}>
            {item.label}
          </span>
          {i === 0 && (
            <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#91040C' }} />
          )}
        </div>
      ))}
    </nav>
  );
}
