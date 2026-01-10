import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './views/Home'
import { Inbox } from './views/Inbox'
import { Project } from './views/Project'
import { Focus } from './views/Focus'
import { Todos } from './views/Todos'
import { Stats } from './views/Stats'
import { DayView } from './views/DayView'
import { Settings } from './views/Settings'
import { KickoffWizard } from './components/KickoffWizard'
import { CopilotModal } from './components/CopilotModal'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="project/:id" element={<Project />} />
          <Route path="focus" element={<Focus />} />
          <Route path="todos" element={<Todos />} />
          <Route path="stats" element={<Stats />} />
          <Route path="day/:date" element={<DayView />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>

      {/* Global Modals */}
      <KickoffWizard />
      <CopilotModal />
    </BrowserRouter>
  )
}

export default App
