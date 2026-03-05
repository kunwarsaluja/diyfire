import {
  html,
  render,
  useState,
  useRef,
  useEffect,
} from 'https://esm.sh/htm/preact/standalone';

const BASE_URL = 'https://feat-embed-content--diyfire--cloudadoption.aem.page';

function Card({ title, children }) {
  return html`
    <div class="card">
      <h3>${title}</h3>
      <p>${children}</p>
    </div>
  `;
}

function Hero() {
  return html`
    <section class="hero">
      <h1>AEM Embed Tester</h1>
      <p>
        This page demonstrates embedding diyfire content in a non-AEM page
        using the <code>${'<aem-embed>'}</code> web component.
        The header and footer above and below are live embeds.
      </p>
    </section>
  `;
}

function CardGrid() {
  return html`
    <section class="card-grid">
      <${Card} title="Shadow DOM Isolation">
        Embedded content renders inside a shadow root, keeping its styles
        completely isolated from this page.
      <//>
      <${Card} title="Zero Build Step">
        This tester uses Preact + htm from a CDN. No bundler, no transpiler,
        just native ES modules.
      <//>
      <${Card} title="Fragment Support">
        Embed any page or fragment path below to see it rendered
        with full block decoration.
      <//>
    </section>
  `;
}

function FragmentEmbedder() {
  const [path, setPath] = useState('');
  const [embedUrl, setEmbedUrl] = useState(null);
  const previewRef = useRef(null);

  useEffect(() => {
    if (!embedUrl || !previewRef.current) return;
    previewRef.current.innerHTML = '';
    const embed = document.createElement('aem-embed');
    embed.setAttribute('url', embedUrl);
    embed.setAttribute('type', 'main');
    previewRef.current.appendChild(embed);
  }, [embedUrl]);

  const handleEmbed = () => {
    const trimmed = path.trim();
    if (!trimmed) return;
    const url = trimmed.startsWith('http') ? trimmed : `${BASE_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
    setEmbedUrl(url);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleEmbed();
  };

  return html`
    <section class="fragment-embedder">
      <h2>Embed a Fragment</h2>
      <div class="embed-controls">
        <div class="field">
          <label for="path-input">Page or fragment path</label>
          <input
            id="path-input"
            type="text"
            placeholder="/fragments/example or full URL"
            value=${path}
            onInput=${(e) => setPath(e.target.value)}
            onKeyDown=${handleKeyDown}
          />
        </div>
        <button onClick=${handleEmbed}>Embed</button>
      </div>
      <div class="preview-container" ref=${previewRef}>
        ${!embedUrl && html`<div class="preview-placeholder">Enter a path and click Embed to preview content.</div>`}
      </div>
      <p class="hint">
        Paths are resolved against <code>${BASE_URL}</code>.
        CORS headers must be configured on the source for cross-origin embedding.
      </p>
    </section>
  `;
}

function App() {
  return html`
    <main class="app-main">
      <${Hero} />
      <${CardGrid} />
      <${FragmentEmbedder} />
      <div class="bottom-content">
        <p>
          Built with Preact + htm — this entire page is a non-AEM surface
          consuming diyfire content via <a href="https://www.aem.live/docs/aem-embed"><code>${'<aem-embed>'}</code></a>.
        </p>
      </div>
    </main>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
