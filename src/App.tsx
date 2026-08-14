import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CandidatePortal } from './components/CandidatePortal'
import { AdminPortal } from './components/AdminPortal'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CandidatePortal />} />
        <Route path="/admin" element={<AdminPortal />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
