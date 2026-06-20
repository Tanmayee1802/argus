import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom'
import { ConnectButton } from '@mysten/dapp-kit'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import ActionLog from './pages/ActionLog'
import Override from './pages/Override'
import ModelConfig from './pages/ModelConfig'

// ── Global custom cursor — shows on every page ──
function CustomCursor() {
  const cursorRef   = useRef<HTMLDivElement>(null)
  const cursorDotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.cursor = 'none'

    const onMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.left = e.clientX + 'px'
        cursorRef.current.style.top  = e.clientY + 'px'
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.body.style.cursor = ''
    }
  }, [])

  return (
    <div ref={cursorRef} style={{
      position:'fixed', pointerEvents:'none', zIndex:99999,
      transform:'translate(-50%,-50%)',
      transition:'left 0.04s ease, top 0.04s ease',
    }}>
      {/* Outer ring */}
      <div style={{
        position:'absolute', width:28, height:28,
        border:'1px solid rgba(0,255,200,0.6)',
        borderRadius:'50%',
        transform:'translate(-50%,-50%)',
        animation:'cursorRing 2s ease-in-out infinite',
      }}/>
      {/* Cross */}
      <div style={{position:'absolute',width:10,height:1,background:'rgba(0,255,200,0.8)',transform:'translate(-50%,-50%)'}}/>
      <div style={{position:'absolute',width:1,height:10,background:'rgba(0,255,200,0.8)',transform:'translate(-50%,-50%)'}}/>
      {/* Center dot */}
      <div style={{position:'absolute',width:3,height:3,background:'#00ffc8',borderRadius:'50%',transform:'translate(-50%,-50%)'}}/>

      <style>{`
        @keyframes cursorRing {
          0%,100% { opacity:.6; transform:translate(-50%,-50%) scale(1);    }
          50%      { opacity:1;  transform:translate(-50%,-50%) scale(1.18); }
        }
        * { cursor: none !important; }
      `}</style>
    </div>
  )
}

function NavBar() {
  return (
    <nav>
      <Link to="/" style={{textDecoration:'none'}}>
        <div className="logo">ARGUS</div>
      </Link>
      <ul className="nav-links">
        <li><NavLink to="/dashboard">DASHBOARD</NavLink></li>
        <li><NavLink to="/log">ACTION LOG</NavLink></li>
        <li><NavLink to="/override">DAO OVERRIDE</NavLink></li>
        <li><NavLink to="/model">MODEL CONFIG</NavLink></li>
      </ul>
      <ConnectButton />
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <Routes>
        <Route path="/"          element={<Landing />} />
        <Route path="/dashboard" element={<><NavBar /><Dashboard /></>} />
        <Route path="/log"       element={<><NavBar /><ActionLog /></>} />
        <Route path="/override"  element={<><NavBar /><Override /></>} />
        <Route path="/model"     element={<><NavBar /><ModelConfig /></>} />
      </Routes>
    </BrowserRouter>
  )
}
