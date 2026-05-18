import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Une nouvelle version de Target est disponible. Mettre à jour maintenant ?')) {
      updateSW(true)
    }
  },
  onRegistered(r) {
    if (r) {
      // Vérifie les mises à jour en arrière-plan à chaque fois que l'application revient au premier plan sur le téléphone
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          r.update().catch((err) => console.error('Erreur lors de la vérification de mise à jour SW:', err))
        }
      })
    }
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
