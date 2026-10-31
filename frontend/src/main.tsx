import ReactDOM from 'react-dom/client';
import App from './app/App';
import { WebSocketProvider } from './app/providers/WebSocketProvider';
import './styles/globals.css';

const materialSymbolsFont = '24px "Material Symbols Outlined"';

function revealMaterialSymbolsWhenReady() {
  if (!('fonts' in document)) return;

  void document.fonts
    .load(materialSymbolsFont)
    .then((loadedFonts) => {
      if (loadedFonts.length > 0) {
        document.documentElement.classList.add('material-symbols-ready');
      }
    })
    .catch(() => {
      // Keep ligature text hidden if the external icon font is unavailable.
    });
}

revealMaterialSymbolsWhenReady();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <WebSocketProvider>
    <App />
  </WebSocketProvider>,
);
