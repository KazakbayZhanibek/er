import { useEffect, useState } from 'react';
import fallback from './content/site.json';
import { validateContent } from '../shared/content-schema.mjs';

export default function useSiteContent() {
  const [content, setContent] = useState(fallback);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}content/site.json`, { cache: 'no-cache', signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(value => { if (!validateContent(value).length) setContent(value); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return content;
}
