import React, { useEffect, useState } from 'react';
import { H4 } from '@blueprintjs/core';
import { RepositoryViewProps } from '@riboseinc/paneron-plugin-kit/types';


export const RepositoryView: React.FC<RepositoryViewProps> =
function () {
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setBusy(false);
    }, 5000);
  }, []);

  return (
    <>
      <H4>{busy ? "Loading…" : "Hello!"}</H4>
    </>
  );
};
