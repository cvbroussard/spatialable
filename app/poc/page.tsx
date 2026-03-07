import { PocClient } from './poc-client';
import { ModelViewerImport } from './model-viewer-import';

export const dynamic = 'force-dynamic';

export default function PocPage() {
  return (
    <>
      <ModelViewerImport />
      <PocClient />
    </>
  );
}
