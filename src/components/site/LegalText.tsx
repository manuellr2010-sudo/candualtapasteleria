/** Muestra textos legales escritos con un formato mínimo (## títulos, - listas) y resalta lo pendiente. */
function mark(line: string) {
  const parts = line.split(/(\[PENDIENTE[^\]]*\])/g);
  return parts.map((p, i) => (p.startsWith("[PENDIENTE") ? <span key={i} className="pending-mark">{p}</span> : p));
}

export function LegalText({ title, text, reviewed }: { title: string; text: string; reviewed: boolean }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`l${blocks.length}`}>{list.map((l, i) => <li key={i}>{mark(l)}</li>)}</ul>);
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      blocks.push(<h2 key={`h${blocks.length}`}>{mark(line.slice(3))}</h2>);
    } else if (line.startsWith("- ")) list.push(line.slice(2));
    else {
      flush();
      blocks.push(<p key={`p${blocks.length}`}>{mark(line)}</p>);
    }
  }
  flush();
  return (
    <div className="page wrap">
      <article className="legal">
        <h1>{title}</h1>
        {!reviewed && (
          <p className="notice notice--warn">
            Texto provisional pendiente de revisión legal. Los datos marcados en amarillo deben completarse antes de publicar la web.
          </p>
        )}
        {blocks}
      </article>
    </div>
  );
}
