import React from 'react';
import { WellnessMark } from '../design-system.jsx';

export function Splash({ theme }) {
  return (
    <div style={{
      minHeight: '100vh', background: theme.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <WellnessMark theme={theme} size={48}/>
    </div>
  );
}
