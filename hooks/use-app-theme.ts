import { useMemo } from 'react';

import { gradients, lightPalette } from '@/constants/design';

export function useAppTheme() {
  const scheme = 'light';

  return useMemo(
    () => ({
      colors: lightPalette,
      gradients: gradients[scheme],
      isDark: false,
      scheme,
    }),
    []
  );
}
