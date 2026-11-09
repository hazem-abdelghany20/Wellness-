import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  listChallengeTemplates, createChallengeTemplate, updateChallengeTemplate,
  setChallengeTemplateArchived, listArticleOptions, uploadChallengeMedia, deleteContentAsset,
} from '../../lib/supabase-admin';
import { buildTemplateRow, validateMediaFile } from '../lib/habit-template.js';

export function useChallengeTemplates() {
  const [templates, setTemplates] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // First load shows the loading state; refreshes after a save keep the
  // page on screen.
  const refetch = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [rows, arts] = await Promise.all([
        listChallengeTemplates(),
        listArticleOptions().catch(() => []),
      ]);
      setTemplates(rows ?? []);
      setArticles(arts ?? []);
    } catch (e) { setError(e); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const habitTemplates = useMemo(
    () => templates.filter((t) => t.kind === 'habit' && !t.archived_at), [templates]);
  const archivedTemplates = useMemo(
    () => templates.filter((t) => t.kind === 'habit' && t.archived_at), [templates]);

  // Raw insert (kept for callers that build their own row).
  const create = useCallback(async (row) => {
    const t = await createChallengeTemplate(row);
    await refetch({ silent: true });
    return t;
  }, [refetch]);

  // Builder form → insert (new) or update (existing). Throws
  // TemplateValidationError with fieldErrors when the form is incomplete.
  const save = useCallback(async (form, existing = null) => {
    let saved;
    if (existing?.id) {
      saved = await updateChallengeTemplate(existing.id, buildTemplateRow(form, { existing }));
    } else {
      const row = buildTemplateRow(form, { existingSlugs: templates.map((t) => t.slug) });
      try {
        saved = await createChallengeTemplate(row);
      } catch (e) {
        // Someone took the slug between our list and the insert: retry once.
        if (String(e?.code) !== '23505') throw e;
        saved = await createChallengeTemplate({ ...row, slug: `${row.slug}-${Math.random().toString(36).slice(2, 6)}` });
      }
    }
    await refetch({ silent: true });
    return saved;
  }, [templates, refetch]);

  const archive = useCallback(async (id) => {
    await setChallengeTemplateArchived(id, true);
    await refetch({ silent: true });
  }, [refetch]);

  const restore = useCallback(async (id) => {
    await setChallengeTemplateArchived(id, false);
    await refetch({ silent: true });
  }, [refetch]);

  // Validate then upload one how-to file. Resolves to the form's media value.
  const uploadMedia = useCallback(async (file, { onProgress, signal } = {}) => {
    const check = validateMediaFile(file);
    if (!check.ok) throw Object.assign(new Error('invalid_media'), { userMessage: check.error });
    const { path, publicUrl } = await uploadChallengeMedia(file, { contentType: check.mime, onProgress, signal });
    return { type: check.kind, url: publicUrl, path, mime: check.mime };
  }, []);

  // Best-effort cleanup of an upload that never got saved on a template.
  const discardMedia = useCallback(async (path) => {
    if (!path) return;
    try { await deleteContentAsset(path); } catch { /* an orphan file is harmless */ }
  }, []);

  return {
    templates, habitTemplates, archivedTemplates, articles, loading, error,
    create, save, archive, restore, uploadMedia, discardMedia, refetch,
  };
}
