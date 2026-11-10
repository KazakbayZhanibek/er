import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, DownloadSimple, Plus, FloppyDisk, Trash, ArrowCounterClockwise } from '@phosphor-icons/react';
import { TEXT_FIELDS, validateContent } from '../shared/content-schema.mjs';
import { api } from './api.js';

const groups = [...new Set(TEXT_FIELDS.map(field => field.group))];

export default function ContentEditor({ mode, onDirty, onExpired }) {
  const [content, setContent] = useState(null);
  const [saved, setSaved] = useState('');
  const [revision, setRevision] = useState(null);
  const [group, setGroup] = useState(groups[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [removed, setRemoved] = useState(null);
  const dirty = content !== null && JSON.stringify(content) !== saved;

  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError(''); setErrors([]);
    try {
      const value = await api('content');
      if (validateContent(value.content).length) throw new Error('El contenido del servidor no tiene un formato válido.');
      setContent(value.content); setSaved(JSON.stringify(value.content)); setRevision(value.revision);
      setConflict(false); setConfirmReload(false); setRemoved(null); setNotice('');
    } catch (failure) { setError(failure.message); if (failure.status === 401) onExpired(); }
    finally { setLoading(false); }
  }

  function update(next) { setContent(next); setNotice(''); setErrors([]); }

  async function save() {
    const validation = validateContent(content);
    setErrors(validation); setError(''); setNotice('');
    if (validation.length) return;
    setSaving(true);
    try {
      const value = await api('content', { method: 'PUT', body: { content, revision } });
      setContent(value.content); setSaved(JSON.stringify(value.content)); setRevision(value.revision); setConflict(false); setRemoved(null);
      setNotice('Cambios guardados. Ya están disponibles en el sitio de este servidor.');
    } catch (failure) {
      if (failure.status === 401) onExpired();
      setConflict(failure.status === 409);
      setError(failure.status === 409 ? 'Hay una versión más reciente. Descarga tu borrador antes de cargar los últimos cambios.' : failure.message);
      if (Array.isArray(failure.details)) setErrors(failure.details);
    } finally { setSaving(false); }
  }

  function exportContent() {
    const blob = new Blob([JSON.stringify(content, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'kompas-contenido.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function moveBlock(index, direction) {
    const blocks = [...content.blocks];
    [blocks[index], blocks[index + direction]] = [blocks[index + direction], blocks[index]];
    update({ ...content, blocks });
  }

  function removeBlock(index) {
    setRemoved({ block: content.blocks[index], index });
    update({ ...content, blocks: content.blocks.filter((_, position) => position !== index) });
  }

  function undoRemove() {
    const blocks = [...content.blocks];
    blocks.splice(Math.min(removed.index, blocks.length), 0, removed.block);
    update({ ...content, blocks }); setRemoved(null);
  }

  if (loading && !content) return <p className="status" role="status">Cargando el contenido…</p>;
  if (!content) return <div className="notice error"><p role="alert">{error}</p><button className="button secondary" onClick={load}>Volver a intentar</button></div>;

  return (
    <>
      <div className="editor-toolbar">
        <div><h2>{mode === 'blocks' ? 'Espacio para novedades.' : 'Las palabras de Kompas.'}</h2><p className="muted">{dirty ? 'Tienes cambios sin guardar.' : 'Todo el contenido está guardado.'}</p></div>
        <div className="row-actions"><button className="button secondary" onClick={exportContent}><DownloadSimple size={18} aria-hidden="true" />Descargar copia</button><button className="button primary" disabled={!dirty || saving || loading || conflict} onClick={save}><FloppyDisk size={18} aria-hidden="true" />{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </div>
      {error && <div className="notice error" role="alert"><p>{error}</p>{conflict && <button className="button secondary" onClick={() => setConfirmReload(true)}>Cargar la última versión</button>}</div>}
      {errors.length > 0 && <div className="notice error" role="alert"><p>Revisa estos campos antes de guardar:</p><ul>{errors.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {notice && <p className="notice success" role="status">{notice}</p>}
      {confirmReload && <div className="notice" role="alert"><p>Cargar la última versión descartará el borrador actual. Puedes descargar una copia antes.</p><div className="row-actions"><button className="button secondary" onClick={() => setConfirmReload(false)}>Conservar borrador</button><button className="button danger" onClick={load}>Descartar y cargar</button></div></div>}
      <fieldset className="editor-fields" disabled={saving || loading}>
        <legend className="sr-only">{mode === 'blocks' ? 'Bloques adicionales' : 'Textos del sitio'}</legend>
        {mode !== 'blocks' ? <div className="text-editor-layout">
          <nav className="group-nav" aria-label="Grupos de textos">{groups.map(item => <button type="button" key={item} onClick={() => setGroup(item)} aria-current={group === item ? 'page' : undefined}>{item}<span aria-hidden="true">↗</span></button>)}</nav>
          <div className="text-fields"><p className="eyebrow">{group}</p>{TEXT_FIELDS.filter(field => field.group === group).map(field => <div className="field" key={field.key}>
            <label htmlFor={`text-${field.key}`}>{field.label}</label>
            {field.maxLength > 180 ? <textarea id={`text-${field.key}`} rows={field.maxLength > 600 ? 5 : 3} maxLength={field.maxLength} value={content.texts[field.key]} onChange={event => update({ ...content, texts: { ...content.texts, [field.key]: event.target.value } })} aria-describedby={`count-${field.key}`} /> : <input id={`text-${field.key}`} maxLength={field.maxLength} value={content.texts[field.key]} onChange={event => update({ ...content, texts: { ...content.texts, [field.key]: event.target.value } })} aria-describedby={`count-${field.key}`} />}
            <p className="field-count" id={`count-${field.key}`}>{content.texts[field.key].length} / {field.maxLength}</p>
          </div>)}</div>
        </div> : <div className="blocks-editor">
          <p className="section-note">Añade información entre «Sobre Kompas» y el contacto. Los bloques mantienen el diseño del sitio y se muestran en el orden de esta lista.</p>
          {removed && <div className="notice removed-note"><span>Bloque retirado del borrador.</span><button className="button quiet" onClick={undoRemove} disabled={content.blocks.length >= 12}><ArrowCounterClockwise size={17} aria-hidden="true" />Deshacer</button></div>}
          {content.blocks.length === 0 && <div className="empty-state"><p className="eyebrow">SIN BLOQUES ADICIONALES</p><h3>Un espacio para lo que viene.</h3><p>Añade una nota, una explicación o información útil para los candidatos.</p></div>}
          {content.blocks.map((block, index) => <article className="block-editor" key={block.id} aria-label={`Bloque ${index + 1}`}>
            <div className="block-topline"><p className="eyebrow">BLOQUE {String(index + 1).padStart(2, '0')}</p><div className="row-actions"><button className="icon-button" type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} aria-label={`Subir bloque ${index + 1}`}><ArrowUp size={18} aria-hidden="true" /></button><button className="icon-button" type="button" onClick={() => moveBlock(index, 1)} disabled={index === content.blocks.length - 1} aria-label={`Bajar bloque ${index + 1}`}><ArrowDown size={18} aria-hidden="true" /></button><button className="icon-button danger" type="button" onClick={() => removeBlock(index)} aria-label={`Quitar bloque ${index + 1}`}><Trash size={18} aria-hidden="true" /></button></div></div>
            <div className="field"><label htmlFor={`block-title-${block.id}`}>Título</label><input id={`block-title-${block.id}`} value={block.title} maxLength={120} onChange={event => update({ ...content, blocks: content.blocks.map(item => item.id === block.id ? { ...item, title: event.target.value } : item) })} /></div>
            <div className="field"><label htmlFor={`block-body-${block.id}`}>Texto</label><textarea id={`block-body-${block.id}`} value={block.body} rows={5} maxLength={3000} onChange={event => update({ ...content, blocks: content.blocks.map(item => item.id === block.id ? { ...item, body: event.target.value } : item) })} /><p className="field-count">{block.body.length} / 3000</p></div>
          </article>)}
          <button className="button secondary" type="button" disabled={content.blocks.length >= 12} onClick={() => update({ ...content, blocks: [...content.blocks, { id: crypto.randomUUID(), title: '', body: '' }] })}><Plus size={19} aria-hidden="true" />Añadir bloque</button><span className="block-count">{content.blocks.length} de 12 bloques</span>
        </div>}
      </fieldset>
    </>
  );
}
