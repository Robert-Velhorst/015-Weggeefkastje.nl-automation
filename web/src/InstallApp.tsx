import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';

interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt>();
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setInstalled(window.matchMedia?.('(display-mode: standalone)').matches ?? false);
    const before = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(undefined); };
    window.addEventListener('beforeinstallprompt', before);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', before); window.removeEventListener('appinstalled', done); };
  }, []);
  async function install() {
    if (!prompt) return;
    setError('');
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { setError('Installeren is nu niet gelukt. Gebruik de uitleg hieronder.'); }
    finally { setPrompt(undefined); }
  }
  return <section className="wk-app-section wk-container" id="app"><div className="wk-app-icon"><Smartphone size={48} strokeWidth={1.4} /><span>♥</span></div><div><p className="wk-eyebrow">ALTIJD BIJ DE HAND</p><h2>Een plekje op je telefoon.</h2><p>Zet Weggeefkastje op je beginscherm. Zo vind je de volgende keer nog sneller een kastje. Gratis, zonder account.</p>
    {installed ? <p className="wk-success" role="status">De app staat klaar op je toestel.</p> : prompt ? <button className="wk-button" type="button" onClick={() => void install()}><Download size={18} />App installeren</button> : null}
    {error && <p role="alert">{error}</p>}
    <details><summary>Hoe zet ik de app op mijn telefoon?</summary><p><strong>iPhone / iPad:</strong> open deze site in Safari, tik op Deel en kies ‘Zet op beginscherm’.</p><p><strong>Android:</strong> open deze site in Chrome en kies in het menu ‘App installeren’ of ‘Toevoegen aan startscherm’. De beschikbaarheid hangt af van je browser.</p><p>Voor actuele kastjes en kaarten heb je internet nodig. Dit is een webapp; je hoeft niets uit een appwinkel te downloaden.</p></details>
  </div></section>;
}
