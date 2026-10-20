import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EvidenceFilesProps {
  names?: string[];
  paths?: string[];
}

const emptyList: string[] = [];

export default function EvidenceFiles({ names = emptyList, paths = emptyList }: EvidenceFilesProps) {
  const [links, setLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    if (!paths.length) {
      setLinks({});
      return () => { active = false; };
    }

    supabase.storage.from('report-evidence').createSignedUrls(paths, 300)
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        setLinks(Object.fromEntries(
          data.flatMap((item, index) => item.signedUrl ? [[paths[index], item.signedUrl]] : [])
        ));
      });

    return () => { active = false; };
  }, [paths]);

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {names.map((name, index) => {
        const path = paths[index];
        const href = path ? links[path] : undefined;
        return href ? (
          <a key={`${name}-${index}`} href={href} target="_blank" rel="noreferrer"
            className="text-xs bg-accent px-2 py-1 rounded hover:underline">
            {name}
          </a>
        ) : (
          <span key={`${name}-${index}`} title={path ? 'Evidence link unavailable. Check the report-evidence Storage policy and migration.' : undefined} className="text-xs bg-accent px-2 py-1 rounded">
            {name}{path ? ' · access unavailable' : ''}
          </span>
        );
      })}
    </div>
  );
}