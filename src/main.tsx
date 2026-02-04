import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import { JoinByCodePage } from './components/JoinByCodePage.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found. Make sure there is a <div id="root"></div> in your HTML.');
}

ReactDOM.createRoot(rootElement).render(
  <BrowserRouter>
    <Routes>
      <Route path="/join/:code" element={<JoinByCodePage />} />
      <Route path="*" element={<App />} />
    </Routes>
  </BrowserRouter>
);
