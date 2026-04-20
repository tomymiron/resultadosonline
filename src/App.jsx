import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Competencias from './screens/Competencias';
import Competencia from './screens/Competencia';
import AtletaDetail from './screens/AtletaDetail';
import ClubDetail from './screens/ClubDetail';
import { DataProvider } from './lib/data.jsx';

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Competencias />} />
          <Route path="/c/:id" element={<Competencia />} />
          <Route path="/c/:id/atleta/:slug" element={<AtletaDetail />} />
          <Route path="/c/:id/club/:slug" element={<ClubDetail />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}
