
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RoleGate from './RoleGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RoleGate />
  </StrictMode>,
)
